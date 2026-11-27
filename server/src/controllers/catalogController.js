import { getCatalog as loadCatalog } from '../services/catalogService.js';

// GET /api/catalog — public. Products, campus zones + hubs, batch slots, fees.
export async function getCatalog(req, res) {
  res.json(await loadCatalog());
}
