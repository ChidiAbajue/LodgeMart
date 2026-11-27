import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  CAMPUS_ZONES,
  BATCH_SLOTS,
  calculateDeliveryFee,
  RIDER_COMMISSION,
  INITIAL_WALLET_BALANCE,
  SANDBOX_ACCOUNTS,
  INITIAL_PRODUCTS,
  INITIAL_VENDORS,
  INITIAL_ORDERS,
  INITIAL_ORDER_ITEMS,
} from '../data/seedData';

const LodgeMartContext = createContext(null);

const STORAGE_KEY = 'lodgemart_state_v1';
const USER_STORAGE_KEY = 'lodgemart_user_v1';

const getInitialState = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to parse saved LodgeMart state:', e);
  }
  return {
    products: INITIAL_PRODUCTS,
    vendors: INITIAL_VENDORS,
    orders: INITIAL_ORDERS,
    orderItems: INITIAL_ORDER_ITEMS,
    stallPickups: [],
    hubArrivals: {},
    walletBalance: INITIAL_WALLET_BALANCE,
    riderEarnings: 0,
    nextOrderNum: 4083,
  };
};

const getInitialUser = () => {
  try {
    const saved = localStorage.getItem(USER_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to parse saved user:', e);
  }
  return null;
};

export function LodgeMartProvider({ children }) {
  const [state, setState] = useState(getInitialState);
  const [currentUser, setCurrentUser] = useState(getInitialUser);
  const [selectedZone, setSelectedZone] = useState(CAMPUS_ZONES[0].name);
  const [selectedHub, setSelectedHub] = useState(CAMPUS_ZONES[0].hubs[0]);
  const [selectedBatchSlot, setSelectedBatchSlot] = useState(
    `${BATCH_SLOTS[1].label} (${BATCH_SLOTS[1].time})`
  );
  const [cart, setCart] = useState([]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to persist LodgeMart state:', e);
    }
  }, [state]);

  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser));
      } else {
        localStorage.removeItem(USER_STORAGE_KEY);
      }
    } catch (e) {
      console.error('Failed to persist user session:', e);
    }
  }, [currentUser]);

  const login = (email, password) => {
    const account = SANDBOX_ACCOUNTS.find(
      (acc) => acc.email.toLowerCase() === email.trim().toLowerCase()
    );
    if (!account) {
      return { ok: false, error: 'Account not found. Use one of the sandbox accounts below.' };
    }
    if (!password || password.length < 4) {
      return { ok: false, error: 'Please enter a valid password.' };
    }
    setCurrentUser(account);
    if (account.campusZone) setSelectedZone(account.campusZone);
    if (account.pickupHub) setSelectedHub(account.pickupHub);
    return { ok: true, user: account };
  };

  const logout = () => {
    setCurrentUser(null);
  };

  const handleZoneChange = (zoneName) => {
    setSelectedZone(zoneName);
    const zoneObj = CAMPUS_ZONES.find((z) => z.name === zoneName);
    if (zoneObj && !zoneObj.hubs.includes(selectedHub)) {
      setSelectedHub(zoneObj.hubs[0]);
    }
  };

  const addToCart = (productId, qty = 1) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === productId);
      if (existing) {
        return prev.map((item) =>
          item.productId === productId ? { ...item, qty: item.qty + qty } : item
        );
      }
      return [...prev, { productId, qty }];
    });
  };

  const updateCartQty = (productId, qty) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((item) => item.productId !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, qty } : item))
    );
  };

  const clearCart = () => setCart([]);

  /**
   * Automated Line-Item Routing Algorithm:
   * 1. Single-Stop Basket Preference (active vendor with ratingScore >= 3.5 & stock for all items)
   * 2. Split-Stall Fallback & Load Balancing (highest-rated active vendor with stock & lowest wholesalePrice)
   * 3. Bag Merge Flagging (requiresBagMerge = true when 2+ distinct vendors assigned)
   */
  const createOrder = ({ paymentMethod, paymentRef, batchSlot }) => {
    if (cart.length === 0) {
      return { ok: false, error: 'Your basket is empty.' };
    }

    const activeVendors = state.vendors.filter((v) => v.ratingScore >= 3.5);
    const orderId = `#${state.nextOrderNum}`;
    const pickupPin = String(Math.floor(1000 + Math.random() * 9000));

    // Step 1: Check Single-Stop Basket Preference
    const singleStopCandidates = activeVendors.filter((vendor) =>
      cart.every((cartItem) => {
        const inv = vendor.inventory[cartItem.productId];
        return inv && inv.stockQty >= cartItem.qty;
      })
    );

    let chosenSingleVendor = null;
    if (singleStopCandidates.length > 0) {
      singleStopCandidates.sort((a, b) => b.ratingScore - a.ratingScore);
      chosenSingleVendor = singleStopCandidates[0];
    }

    const newOrderItems = [];
    const updatedVendors = state.vendors.map((v) => ({
      ...v,
      inventory: { ...v.inventory },
    }));

    for (let idx = 0; idx < cart.length; idx++) {
      const cartItem = cart[idx];
      const product = state.products.find((p) => p.id === cartItem.productId);
      if (!product) continue;

      let assignedVendor = chosenSingleVendor;

      // Step 2: Split-Stall Fallback & Load Balancing
      if (!assignedVendor) {
        const eligible = activeVendors
          .filter((v) => {
            const inv = v.inventory[cartItem.productId];
            return inv && inv.stockQty >= cartItem.qty;
          })
          .sort((a, b) => {
            if (b.ratingScore !== a.ratingScore) {
              return b.ratingScore - a.ratingScore;
            }
            const leaveAtKiosk = (orderId) => {
    setState((prev) => ({
      ...prev,
      orders: prev.orders.map((o) =>
        o.id === orderId
          ? { ...o, status: 'Left at Junction Kiosk', deliveredTo: 'Partnered Junction Kiosk' }
          : o
      ),
    }));
  };

  const toggleVendorPriority = (vendorId) => {
    setState((prev) => ({
      ...prev,
      vendors: prev.vendors.map((v) => {
        if (v.id !== vendorId || v.ratingScore < 4.5) return v;
        return { ...v, priorityTier: !v.priorityTier };
      }),
    }));
  };

  return (
              a.inventory[cartItem.productId].wholesalePrice -
              b.inventory[cartItem.productId].wholesalePrice
            );
          });

        if (eligible.length === 0) {
          return {
            ok: false,
            error: `Insufficient active vendor stock for ${product.name}.`,
          };
        }
        assignedVendor = eligible[0];
      }

      const vendorRef = updatedVendors.find((v) => v.id === assignedVendor.id);
      const wholesaleCost = vendorRef.inventory[cartItem.productId].wholesalePrice;
      vendorRef.inventory[cartItem.productId] = {
        ...vendorRef.inventory[cartItem.productId],
        stockQty: vendorRef.inventory[cartItem.productId].stockQty - cartItem.qty,
      };

      newOrderItems.push({
        itemId: `oi-${state.nextOrderNum}-${idx + 1}`,
        orderId,
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        qty: cartItem.qty,
        studentPrice: product.studentPrice,
        wholesaleCost,
        assignedVendorId: assignedVendor.id,
        vendorPacked: false,
        riderPickedUp: false,
        itemRating: null,
        issueTag: null,
      });
    }

    // Step 3: Bag Merge Flagging
    const distinctVendors = new Set(newOrderItems.map((i) => i.assignedVendorId));
    const requiresBagMerge = distinctVendors.size >= 2;

    const { totalFee: deliveryFee, itemsSubtotal } = calculateDeliveryFee(cart, state.products);
    const totalAmount = itemsSubtotal + deliveryFee;

    if (paymentMethod === 'LodgeMart Wallet' && state.walletBalance < totalAmount) {
      return { ok: false, error: 'Insufficient LodgeMart Wallet balance.' };
    }

    const newOrder = {
      id: orderId,
      studentName: currentUser?.name || 'Chinedu Okafor',
      studentEmail: currentUser?.email || 'chinedu.unizik@gmail.com',
      campusZone: selectedZone,
      pickupHub: selectedHub,
      batchSlot: batchSlot || selectedBatchSlot,
      status: 'Order Placed',
      pickupPin,
      delegateInfo: {
        name: '',
        phone: '',
        active: false,
      },
      requiresBagMerge,
      deliveryFee,
      totalAmount,
      paymentMethod,
      paymentRef: paymentRef || `LM-${Date.now()}`,
      createdAt: new Date().toISOString(),
      deliveredTo: null,
      rated: false,
    };

    setState((prev) => ({
      ...prev,
      vendors: updatedVendors,
      orders: [newOrder, ...prev.orders],
      orderItems: [...prev.orderItems, ...newOrderItems],
      walletBalance:
        paymentMethod === 'LodgeMart Wallet'
          ? prev.walletBalance - totalAmount
          : prev.walletBalance,
      nextOrderNum: prev.nextOrderNum + 1,
    }));

    clearCart();
    return { ok: true, order: newOrder };
  };

  const toggleItemPacked = (itemId) => {
    setState((prev) => {
      const updatedItems = prev.orderItems.map((item) =>
        item.itemId === itemId ? { ...item, vendorPacked: !item.vendorPacked } : item
      );

      const targetItem = updatedItems.find((i) => i.itemId === itemId);
      const updatedOrders = prev.orders.map((order) => {
        if (order.id !== targetItem?.orderId) return order;
        const itemsForOrder = updatedItems.filter((i) => i.orderId === order.id);
        const allPacked = itemsForOrder.every((i) => i.vendorPacked);
        if (allPacked && order.status === 'Order Placed') {
          return { ...order, status: 'Packed at Market' };
        }
        if (!allPacked && order.status === 'Packed at Market') {
          return { ...order, status: 'Order Placed' };
        }
        return order;
      });

      return {
        ...prev,
        orderItems: updatedItems,
        orders: updatedOrders,
      };
    });
  };

  const confirmStallPickup = (vendorId, batchSlot, photoDataUrl) => {
    setState((prev) => {
      const itemsToCollect = prev.orderItems.filter(
        (item) => item.assignedVendorId === vendorId && !item.riderPickedUp
      );

      const payoutAmount = itemsToCollect.reduce(
        (sum, item) => sum + item.wholesaleCost * item.qty,
        0
      );

      const updatedItems = prev.orderItems.map((item) =>
        item.assignedVendorId === vendorId && !item.riderPickedUp
          ? { ...item, riderPickedUp: true, vendorPacked: true }
          : item
      );

      const updatedVendors = prev.vendors.map((v) =>
        v.id === vendorId
          ? { ...v, walletBalance: v.walletBalance + payoutAmount }
          : v
      );

      const updatedOrders = prev.orders.map((order) => {
        const orderItems = updatedItems.filter((i) => i.orderId === order.id);
        const allPickedUp = orderItems.length > 0 && orderItems.every((i) => i.riderPickedUp);
        if (allPickedUp && (order.status === 'Order Placed' || order.status === 'Packed at Market')) {
          return { ...order, status: 'Rider In Transit' };
        }
        return order;
      });

      const newPickup = {
        id: `sp-${Date.now()}`,
        vendorId,
        batchSlot: batchSlot || 'Active Batch',
        photoDataUrl,
        capturedAt: new Date().toISOString(),
        payoutReleased: true,
        payoutAmount,
      };

      return {
        ...prev,
        orderItems: updatedItems,
        vendors: updatedVendors,
        orders: updatedOrders,
        stallPickups: [newPickup, ...prev.stallPickups],
      };
    });
  };

  const markHubArrived = (hubName) => {
    setState((prev) => ({
      ...prev,
      hubArrivals: {
        ...prev.hubArrivals,
        [hubName]: Date.now(),
      },
      orders: prev.orders.map((order) =>
        order.pickupHub === hubName && order.status === 'Rider In Transit'
          ? { ...order, status: 'Ready at Hub' }
          : order
      ),
    }));
  };

  const verifyHandoverPin = (orderId, enteredPin) => {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return { ok: false, error: 'Order not found.' };
    if (order.pickupPin !== enteredPin.trim()) {
      return { ok: false, error: 'Invalid 4-digit PIN. Check with student or delegate.' };
    }

    const recipient = order.delegateInfo?.active
      ? `${order.delegateInfo.name} (Delegate)`
      : order.studentName;

    setState((prev) => ({
      ...prev,
      orders: prev.orders.map((o) =>
        o.id === orderId
          ? { ...o, status: 'Collected', deliveredTo: recipient }
          : o
      ),
      riderEarnings: prev.riderEarnings + RIDER_COMMISSION,
    }));

    return { ok: true, recipient };
  };

  const delegateOrderPin = (orderId, roommateName, roommatePhone) => {
    const newPin = String(Math.floor(1000 + Math.random() * 9000));
    setState((prev) => ({
      ...prev,
      orders: prev.orders.map((o) =>
        o.id === orderId
          ? {
              ...o,
              pickupPin: newPin,
              delegateInfo: {
                name: roommateName.trim(),
                phone: roommatePhone.trim(),
                active: true,
              },
            }
          : o
      ),
    }));
    return newPin;
  };

  const submitOrderRating = (orderId, stars, flaggedItemsMap = {}) => {
    setState((prev) => {
      const itemsInOrder = prev.orderItems.filter((i) => i.orderId === orderId);
      const vendorRatingsToApply = {};

      const updatedOrderItems = prev.orderItems.map((item) => {
        if (item.orderId !== orderId) return item;
        const issueTag = flaggedItemsMap[item.itemId] || null;

        if (stars >= 4) {
          vendorRatingsToApply[item.assignedVendorId] = stars;
          return { ...item, itemRating: stars, issueTag: null };
        }

        // Low rating (1-3 stars): penalize ONLY flagged items' vendors, preserve 5-star for unflagged
        if (issueTag) {
          vendorRatingsToApply[item.assignedVendorId] = stars;
          return { ...item, itemRating: stars, issueTag };
        } else {
          if (vendorRatingsToApply[item.assignedVendorId] === undefined) {
            vendorRatingsToApply[item.assignedVendorId] = 5;
          }
          return { ...item, itemRating: 5, issueTag: null };
        }
      });

      const updatedVendors = prev.vendors.map((v) => {
        const appliedRating = vendorRatingsToApply[v.id];
        if (appliedRating === undefined) return v;
        const newCount = v.ratingCount + 1;
        const newScore = Number(
          ((v.ratingScore * v.ratingCount + appliedRating) / newCount).toFixed(2)
        );
        return {
          ...v,
          ratingScore: newScore,
          ratingCount: newCount,
        };
      });

      const hasFlagged = stars <= 3 && Object.keys(flaggedItemsMap).length > 0;
      const updatedOrders = prev.orders.map((o) =>
        o.id === orderId
          ? { ...o, rated: true, replacementCredit: hasFlagged }
          : o
      );

      return {
        ...prev,
        orderItems: updatedOrderItems,
        vendors: updatedVendors,
        orders: updatedOrders,
      };
    });
  };

  const resetSampleData = () => {
    const fresh = {
      products: INITIAL_PRODUCTS,
      vendors: INITIAL_VENDORS,
      orders: INITIAL_ORDERS,
      orderItems: INITIAL_ORDER_ITEMS,
      stallPickups: [],
      hubArrivals: {},
      walletBalance: INITIAL_WALLET_BALANCE,
      riderEarnings: 0,
      nextOrderNum: 4083,
    };
    setState(fresh);
    setCart([]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  };

  const CANCELLATION_FEE = 200;

  const cancelOrder = (orderId) => {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return { ok: false, error: 'Order not found.' };
    if (order.status !== 'Order Placed' && order.status !== 'Packed at Market') {
      return {
        ok: false,
        error: 'Order cannot be cancelled once the rider has picked it up.',
      };
    }

    const refundAmount = Math.max(0, order.totalAmount - CANCELLATION_FEE);

    setState((prev) => {
      const itemsToRestore = prev.orderItems.filter((i) => i.orderId === orderId);
      const updatedVendors = prev.vendors.map((v) => {
        const vendorItems = itemsToRestore.filter((i) => i.assignedVendorId === v.id);
        if (vendorItems.length === 0) return v;
        const nextInv = { ...v.inventory };
        vendorItems.forEach((vi) => {
          if (nextInv[vi.productId]) {
            nextInv[vi.productId] = {
              ...nextInv[vi.productId],
              stockQty: nextInv[vi.productId].stockQty + vi.qty,
            };
          }
        });
        return { ...v, inventory: nextInv };
      });

      return {
        ...prev,
        vendors: updatedVendors,
        orders: prev.orders.map((o) =>
          o.id === orderId ? { ...o, status: 'Cancelled' } : o
        ),
        walletBalance: prev.walletBalance + refundAmount,
      };
    });

    return { ok: true, refundAmount, fee: CANCELLATION_FEE };
  };

  const updateVendorInventory = (vendorId, productId, wholesalePrice, stockQty) => {
    setState((prev) => ({
      ...prev,
      vendors: prev.vendors.map((v) => {
        if (v.id !== vendorId) return v;
        return {
          ...v,
          inventory: {
            ...v.inventory,
            [productId]: {
              wholesalePrice: Math.max(0, Number(wholesalePrice) || 0),
              stockQty: Math.max(0, Number(stockQty) || 0),
            },
          },
        };
      }),
    }));
  };

  const leaveAtKiosk = (orderId) => {
    setState((prev) => ({
      ...prev,
      orders: prev.orders.map((o) =>
        o.id === orderId
          ? { ...o, status: 'Left at Junction Kiosk', deliveredTo: 'Partnered Junction Kiosk' }
          : o
      ),
    }));
  };

  const toggleVendorPriority = (vendorId) => {
    setState((prev) => ({
      ...prev,
      vendors: prev.vendors.map((v) => {
        if (v.id !== vendorId || v.ratingScore < 4.5) return v;
        return { ...v, priorityTier: !v.priorityTier };
      }),
    }));
  };

  return (
    <LodgeMartContext.Provider
      value={{
        ...state,
        currentUser,
        login,
        logout,
        selectedZone,
        selectedHub,
        setSelectedHub,
        handleZoneChange,
        selectedBatchSlot,
        setSelectedBatchSlot,
        cart,
        addToCart,
        updateCartQty,
        clearCart,
        createOrder,
        toggleItemPacked,
        confirmStallPickup,
        markHubArrived,
        verifyHandoverPin,
        delegateOrderPin,
        submitOrderRating,
        resetSampleData,
        cancelOrder,
        updateVendorInventory,
        leaveAtKiosk,
        toggleVendorPriority,
      }}
    >
      {children}
    </LodgeMartContext.Provider>
  );
}

export function useLodgeMart() {
  const ctx = useContext(LodgeMartContext);
  if (!ctx) {
    throw new Error('useLodgeMart must be used within a LodgeMartProvider');
  }
  return ctx;
}
