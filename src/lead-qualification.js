const DISQUALIFIED_SALES_RANGES = new Set(['0-5', '5-15', '15-20']);
const QUALIFIED_SALES_RANGES = new Set(['20-30', '30+']);

function classifyLead(monthlySales) {
  if (DISQUALIFIED_SALES_RANGES.has(monthlySales)) return 'disqualified';
  if (QUALIFIED_SALES_RANGES.has(monthlySales)) return 'qualified';
  throw new Error(`Faixa de vendas inválida para qualificação: ${monthlySales}`);
}

globalThis.OldLabLeadQualification = { classifyLead };
