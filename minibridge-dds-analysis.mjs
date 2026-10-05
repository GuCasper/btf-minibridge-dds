const SEATS = ['north', 'east', 'south', 'west'];
const SUITS = ['S', 'H', 'D', 'C'];
const STRAINS = [...SUITS, 'NT'];
const RANKS = 'AKQJT98765432';
const VULNERABILITY = {none: 0, both: 1, NS: 2, EW: 3};
const VULNERABILITY_CYCLE = ['none', 'NS', 'EW', 'both', 'NS', 'EW', 'both', 'none', 'EW', 'both', 'none', 'NS', 'both', 'none', 'NS', 'EW'];

export function analyzeDeal(dds, input) {
  if (!input || typeof input !== 'object' || !input.hands) throw new Error('Hands are required');
  const seen = new Set();
  for (const seat of SEATS) {
    const hand = input.hands[seat];
    if (!Array.isArray(hand) || hand.length !== 13) throw new Error('Each seat must have 13 cards');
    for (const card of hand) {
      if (typeof card !== 'string' || !/^[SHDC][2-9TJQKA]$/.test(card) || seen.has(card)) throw new Error('Invalid or duplicate card');
      seen.add(card);
    }
  }
  const board = input.board ?? 1;
  if (!Number.isInteger(board) || board < 1) throw new Error('Invalid board');
  const vulnerability = input.vulnerability ?? VULNERABILITY_CYCLE[(board - 1) % 16];
  if (!Object.hasOwn(VULNERABILITY, vulnerability)) throw new Error('Invalid vulnerability');
  const dealer = input.dealer ?? SEATS[(board - 1) % 4];
  if (!SEATS.includes(dealer)) throw new Error('Invalid dealer');
  const pbnHand = hand => SUITS.map(suit => [...RANKS].filter(rank => hand.includes(suit + rank)).join('')).join('.');
  const table = dds.CalcDDTablePBN({cards: `N:${SEATS.map(seat => pbnHand(input.hands[seat])).join(' ')}`});
  const tricks = Object.fromEntries(SEATS.map((seat, index) => [seat,
    Object.fromEntries(STRAINS.map((strain, row) => [strain, table.resTable[row][index]]))
  ]));
  const par = dds.DealerPar(table, SEATS.indexOf(dealer), VULNERABILITY[vulnerability]);
  return {
    engine: 'dds', tricks,
    par: {score_ns: par.score, score_ew: -par.score, contracts: par.contracts, dealer, vulnerability}
  };
}
