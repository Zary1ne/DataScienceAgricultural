export const SETTLEMENT_BASE_YIELD_KG_PER_MU = 620;

function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

/** 单个地块的亩产估算：健康值、生理进度和当前生长速率共同参与结算。 */
export function estimatePlotYieldKgPerMu(state, baseYield = SETTLEMENT_BASE_YIELD_KG_PER_MU) {
  if (!state) return 0;
  const healthFactor = clamp(state.params?.healthPct, 0, 100) / 100;
  const progressFactor = 0.55 + 0.45 * clamp(state.physiologicalProgress, 0, 100) / 100;
  const vigorFactor = 0.55 + 0.45 * clamp(state.growthRatePct, 0, 100) / 100;
  // 停滞地块不能继续按“完全受阻”同一档处理，需要保留更明确的减产梯度。
  const blockedFactor = state.growthStalled ? 0.68 : state.stressed ? 0.84 : 1;
  return baseYield * healthFactor * progressFactor * vigorFactor * blockedFactor;
}

export function summarizePlotSettlement(
  states,
  baseYield = SETTLEMENT_BASE_YIELD_KG_PER_MU
) {
  const plots = Object.values(states || {});
  if (!plots.length) {
    return {
      averageHealthPct: 100,
      averageProgressPct: 0,
      averageGrowthRatePct: 0,
      blockedPlotRatio: 0,
      estimatedYieldKgPerMu: 0,
    };
  }

  const totals = plots.reduce(
    (result, state) => {
      result.health += clamp(state.params?.healthPct, 0, 100);
      result.progress += clamp(state.physiologicalProgress, 0, 100);
      result.growthRate += clamp(state.growthRatePct, 0, 100);
      result.blocked += state.stressed || state.growthStalled ? 1 : 0;
      result.yield += estimatePlotYieldKgPerMu(state, baseYield);
      return result;
    },
    { health: 0, progress: 0, growthRate: 0, blocked: 0, yield: 0 }
  );

  return {
    averageHealthPct: totals.health / plots.length,
    averageProgressPct: totals.progress / plots.length,
    averageGrowthRatePct: totals.growthRate / plots.length,
    blockedPlotRatio: totals.blocked / plots.length,
    estimatedYieldKgPerMu: Math.round(totals.yield / plots.length),
  };
}
