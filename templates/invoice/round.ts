// two decimals at most, printed without trailing zeros
export const round = (value: number | string): number => Math.round(Number(value) * 100) / 100
