// Menghitung dana misi yang didapat dari sebuah hasil. Gagal = tidak dapat dana.
import { REWARD } from '../data/levels.js';

// bonus = dana tambahan khusus level (juta $), misalnya orbit tepat atau foto lengkap.
export function missionReward({ success, stars, budget, price, bonus = 0 }) {
  if (!success) return 0;
  const savings = Math.max(0, budget - price) * REWARD.savingsShare;
  return Math.round(stars * REWARD.perStar + savings + bonus);
}
