import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, hasToken, onUnauthorized, setToken } from '../lib/api';
import { adaptCatalog, adaptOrder, adaptUser, toNaira } from '../lib/adapters';

// App-wide state, backed by the LodgeMart API (server/). Prices, totals, PINs
// and order statuses always come from the server; the basket lives on the
// device until checkout. Vendor / rider / admin pages load their own data.

const LodgeMartContext = createContext(null);
const CART_KEY = 'lodgemart_cart_v2';
const DROP_KEY = 'lodgemart_dropoff_v2';

const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};
const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: keep it in memory */
  }
};

const fail = (err) => ({ ok: false, error: err.message, code: err.code, details: err.details });

export function LodgeMartProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady] = useState(!hasToken());
  const [catalog, setCatalog] = useState(null);
  const [catalogError, setCatalogError] = useState('');
  const [cart, setCart] = useState(() => readJson(CART_KEY, []));
  const [dropoff, setDropoff] = useState(() => readJson(DROP_KEY, { zoneId: '', hubId: '', slotId: 'evening' }));
  const [wallet, setWallet] = useState(null); // { balance, virtualAccount, fundingAvailable, recentFundings }
  const [orders, setOrders] = useState([]);

  useEffect(() => writeJson(CART_KEY, cart), [cart]);
  useEffect(() => writeJson(DROP_KEY, dropoff), [dropoff]);

  // ---- catalog ---------------------------------------------------------------
  const refreshCatalog = useCallback(async () => {
    try {
      const data = adaptCatalog(await api('/catalog'));
      setCatalog(data);
      setCatalogError('');
      setDropoff((d) => {
        const zone = data.zones.find((z) => z.id === d.zoneId) || data.zones[0];
        const hub = zone?.hubs.find((h) => h.id === d.hubId) || zone?.hubs[0];
        const slot = data.slots.find((s) => s.id === d.slotId) || data.slots[0];
        return { zoneId: zone?.id || '', hubId: hub?.id || '', slotId: slot?.id || '' };
      });
    } catch (err) {
      setCatalogError(err.message);
    }
  }, []);
  useEffect(() => {
    refreshCatalog();
  }, [refreshCatalog]);

  // ---- session ---------------------------------------------------------------
  const clearSession = useCallback(() => {
    setCurrentUser(null);
    setWallet(null);
    setOrders([]);
  }, []);
  useEffect(() => onUnauthorized(clearSession), [clearSession]);

  const refreshWallet = useCallback(async () => {
    try {
      const w = await api('/wallet');
      setWallet({
        balance: toNaira(w.balanceKobo),
        virtualAccount: w.virtualAccount,
        fundingAvailable: w.fundingAvailable,
        recentFundings: (w.recentFundings || []).map((f) => ({ amount: toNaira(f.amountKobo), createdAt: f.createdAt })),
      });
    } catch {
      /* shown as unavailable */
    }
  }, []);

  const refreshOrders = useCallback(async () => {
    const { orders: list } = await api('/orders');
    setOrders(list.map(adaptOrder));
    return list;
  }, []);

  const loadStudentData = useCallback(async () => {
    await Promise.allSettled([refreshWallet(), refreshOrders()]);
  }, [refreshOrders, refreshWallet]);

  const applyUser = useCallback(
    (apiUser) => {
      const u = adaptUser(apiUser);
      setCurrentUser(u);
      if (u.role === 'student') {
        if (u.defaultZoneId) setDropoff((d) => ({ ...d, zoneId: u.defaultZoneId, hubId: u.defaultHubId || d.hubId }));
        loadStudentData();
      }
      return u;
    },
    [loadStudentData],
  );

  useEffect(() => {
    if (!hasToken()) return;
    api('/auth/me')
      .then(({ user }) => applyUser(user))
      .catch(() => setToken(null))
      .finally(() => setAuthReady(true));
  }, [applyUser]);

  const login = useCallback(
    async (email, password) => {
      try {
        const { token, user } = await api('/auth/login', { method: 'POST', body: { email, password } });
        setToken(token);
        return { ok: true, user: applyUser(user) };
      } catch (err) {
        return fail(err);
      }
    },
    [applyUser],
  );

  const register = useCallback(
    async ({ name, email, phone, password }) => {
      try {
        const body = { name, email, password, ...(phone && { phone }) };
        const { token, user } = await api('/auth/register', { method: 'POST', body });
        setToken(token);
        return { ok: true, user: applyUser(user) };
      } catch (err) {
        return fail(err);
      }
    },
    [applyUser],
  );

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      /* token may already be gone */
    }
    setToken(null);
    clearSession();
  }, [clearSession]);

  // ---- basket & drop-off -------------------------------------------------------
  const addToCart = useCallback((productId, qty = 1) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === productId);
      if (existing) return prev.map((i) => (i.productId === productId ? { ...i, qty: Math.min(50, i.qty + qty) } : i));
      return [...prev, { productId, qty }];
    });
  }, []);
  const updateCartQty = useCallback((productId, qty) => {
    setCart((prev) =>
      qty <= 0 ? prev.filter((i) => i.productId !== productId) : prev.map((i) => (i.productId === productId ? { ...i, qty: Math.min(50, qty) } : i)),
    );
  }, []);
  const clearCart = useCallback(() => setCart([]), []);

  const handleZoneChange = useCallback(
    (zoneId) => {
      const zone = catalog?.zones.find((z) => z.id === zoneId);
      setDropoff((d) => ({ ...d, zoneId, hubId: zone?.hubs.some((h) => h.id === d.hubId) ? d.hubId : zone?.hubs[0]?.id || '' }));
    },
    [catalog],
  );
  const setSelectedHub = useCallback((hubId) => setDropoff((d) => ({ ...d, hubId })), []);
  const setSelectedBatchSlot = useCallback((slotId) => setDropoff((d) => ({ ...d, slotId })), []);

  // ---- orders ------------------------------------------------------------------
  // paymentMethod: 'WALLET' | 'BANK_TRANSFER'
  const createOrder = useCallback(
    async (paymentMethod) => {
      if (cart.length === 0) return { ok: false, error: 'Your basket is empty.' };
      try {
        const res = await api('/orders', {
          method: 'POST',
          body: {
            items: cart.map((i) => ({ productId: i.productId, qty: i.qty })),
            zoneId: dropoff.zoneId,
            hubId: dropoff.hubId,
            batchSlotId: dropoff.slotId,
            paymentMethod,
          },
        });
        clearCart();
        await Promise.allSettled([refreshOrders(), refreshWallet(), refreshCatalog()]);
        return { ok: true, order: adaptOrder(res.order), payment: res.payment || null };
      } catch (err) {
        if (err.code === 'OUT_OF_STOCK') refreshCatalog();
        return fail(err);
      }
    },
    [cart, dropoff, clearCart, refreshOrders, refreshWallet, refreshCatalog],
  );

  const verifyPayment = useCallback(
    async (orderId) => {
      try {
        const { order } = await api(`/orders/${orderId}/verify-payment`, { method: 'POST' });
        await refreshOrders();
        return { ok: true, order: adaptOrder(order) };
      } catch (err) {
        return fail(err);
      }
    },
    [refreshOrders],
  );

  const cancelOrder = useCallback(
    async (orderId) => {
      try {
        const res = await api(`/orders/${orderId}/cancel`, { method: 'POST' });
        await Promise.allSettled([refreshOrders(), refreshWallet(), refreshCatalog()]);
        return { ok: true, refundAmount: toNaira(res.refundKobo), fee: toNaira(res.cancellationFeeKobo) };
      } catch (err) {
        return fail(err);
      }
    },
    [refreshOrders, refreshWallet, refreshCatalog],
  );

  const delegateOrderPin = useCallback(
    async (orderId, name, phone) => {
      try {
        const res = await api(`/orders/${orderId}/delegate`, { method: 'POST', body: { name: name.trim(), phone: phone.trim() } });
        await refreshOrders();
        return { ok: true, pin: res.pickupPin };
      } catch (err) {
        return fail(err);
      }
    },
    [refreshOrders],
  );

  // flaggedItemsMap: { [itemId]: issueTag }
  const submitOrderRating = useCallback(
    async (orderId, stars, flaggedItemsMap = {}) => {
      try {
        const flaggedItems = stars <= 3 ? Object.entries(flaggedItemsMap).map(([itemId, issueTag]) => ({ itemId, issueTag })) : [];
        const res = await api(`/orders/${orderId}/rating`, { method: 'POST', body: { stars, flaggedItems } });
        await refreshOrders();
        return { ok: true, replacementCredit: res.replacementCredit };
      } catch (err) {
        return fail(err);
      }
    },
    [refreshOrders],
  );

  const createVirtualAccount = useCallback(
    async (ids) => {
      try {
        await api('/wallet/virtual-account', { method: 'POST', body: ids });
        await refreshWallet();
        return { ok: true };
      } catch (err) {
        return fail(err);
      }
    },
    [refreshWallet],
  );

  const value = useMemo(() => {
    const zones = catalog?.zones || [];
    const zone = zones.find((z) => z.id === dropoff.zoneId);
    const hub = zone?.hubs.find((h) => h.id === dropoff.hubId);
    const slot = catalog?.slots.find((s) => s.id === dropoff.slotId);
    return {
      // session
      currentUser,
      authReady,
      login,
      register,
      logout,
      // catalog
      catalog,
      catalogError,
      refreshCatalog,
      products: catalog?.products || [],
      zones,
      slots: catalog?.slots || [],
      feeRules: catalog?.feeRules,
      // drop-off
      selectedZoneId: dropoff.zoneId,
      selectedHubId: dropoff.hubId,
      selectedSlotId: dropoff.slotId,
      selectedZone: zone?.name || '',
      selectedHub: hub?.name || '',
      selectedSlot: slot,
      handleZoneChange,
      setSelectedHub,
      setSelectedBatchSlot,
      // basket
      cart,
      addToCart,
      updateCartQty,
      clearCart,
      // student wallet + orders
      wallet,
      walletBalance: wallet?.balance ?? currentUser?.walletBalance ?? 0,
      refreshWallet,
      createVirtualAccount,
      orders,
      refreshOrders,
      createOrder,
      verifyPayment,
      cancelOrder,
      delegateOrderPin,
      submitOrderRating,
    };
  }, [
    currentUser, authReady, login, register, logout, catalog, catalogError, refreshCatalog, dropoff,
    handleZoneChange, setSelectedHub, setSelectedBatchSlot, cart, addToCart, updateCartQty, clearCart,
    wallet, refreshWallet, createVirtualAccount, orders, refreshOrders, createOrder, verifyPayment,
    cancelOrder, delegateOrderPin, submitOrderRating,
  ]);

  return <LodgeMartContext.Provider value={value}>{children}</LodgeMartContext.Provider>;
}

export function useLodgeMart() {
  const ctx = useContext(LodgeMartContext);
  if (!ctx) throw new Error('useLodgeMart must be used within a LodgeMartProvider');
  return ctx;
}
