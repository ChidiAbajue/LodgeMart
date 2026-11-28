import * as walletService from '../services/walletService.js';

// GET /api/wallet — balance + the student's Monnify virtual account (if created).
export async function getWallet(req, res) {
  res.json(await walletService.getWallet(req.user));
}

// POST /api/wallet/virtual-account  { bvn } or { nin } — create it once.
export async function createVirtualAccount(req, res) {
  res.status(201).json(await walletService.createVirtualAccount(req.user, req.body));
}
