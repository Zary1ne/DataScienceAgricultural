<template>
  <div class="m-card stock-card">
    <div class="stock-left">
      <div class="stock-name">{{ stock.name }}</div>
      <div class="m-mono stock-code">{{ stock.code }}</div>
    </div>
    <div class="stock-right">
      <div class="stock-price num" :class="trend">{{ stock.price.toFixed(2) }}</div>
      <div class="stock-change num" :class="trend">
        {{ stock.change >= 0 ? "+" : "" }}{{ stock.change.toFixed(2) }}
        （{{ stock.changePercent >= 0 ? "+" : "" }}{{ stock.changePercent.toFixed(2) }}%）
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  stock: { type: Object, required: true },
});

// 中国股市：红涨绿跌
const trend = computed(() => (props.stock.change >= 0 ? "up" : "down"));
</script>

<style scoped>
.stock-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
}

.stock-name {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--ink);
}

.stock-code {
  margin-top: 4px;
  opacity: 0.7;
}

.stock-right {
  text-align: right;
}

.stock-price {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.stock-change {
  font-size: 13px;
  margin-top: 3px;
  font-variant-numeric: tabular-nums;
}

.up {
  color: #e5484d;
}

.down {
  color: #2f9e44;
}
</style>
