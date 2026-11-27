// Product photos live in /public/products (licences: /public/products/CREDITS.md).
// Kept separate from product data so persisted state and the future API need no image field.
const PRODUCT_IMAGES = {
  'sku-rice': '/products/sku-rice.webp',
  'sku-garri': '/products/sku-garri.webp',
  'sku-beans': '/products/sku-beans.webp',
  'sku-indomie': '/products/sku-indomie.webp',
  'sku-oil': '/products/sku-oil.webp',
  'sku-spaghetti': '/products/sku-spaghetti.webp',
  'sku-milo': '/products/sku-milo.webp',
  'sku-detergent': '/products/sku-detergent.webp',
};

export const getProductImage = (productId) => PRODUCT_IMAGES[productId] || null;
