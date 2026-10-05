import http from "node:http";
import { timingSafeEqual } from "node:crypto";
import { Dds, loadDds } from "./api.js";
import { analyzeDeal } from "./minibridge-dds-analysis.mjs";

const PORT = Number.parseInt(process.env.PORT || "8080", 10);
const API_TOKEN = process.env.DDS_API_TOKEN || "";
const SEATS = ["north", "east", "south", "west"];
const SUITS = ["S", "H", "D", "C"];
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
const TRUMPS = { S: 0, H: 1, D: 2, C: 3, NT: 4 };
const MAX_BODY_BYTES = 32768;
const dds = new Dds(await loadDds());

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(payload), "Cache-Control": "no-store" });
  res.end(payload);
}

function authorized(req) {
  if (!API_TOKEN) return true;
  const supplied = req.headers.authorization || "";
  const expected = `Bearer ${API_TOKEN}`;
  const a = Buffer.from(supplied); const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function validCard(card) {
  return typeof card === "string" && card.length === 2 && SUITS.includes(card[0]) && RANKS.includes(card[1]);
}

function validate(input) {
  if (!input || typeof input !== "object" || !input.hands || typeof input.hands !== "object") throw new Error("hands are required");
  if (!SEATS.includes(input.turn)) throw new Error("invalid turn");
  if (!input.contract || !Object.hasOwn(TRUMPS, input.contract.strain)) throw new Error("invalid contract strain");
  const trick = input.current_trick ?? [];
  if (!Array.isArray(trick) || trick.length > 3) throw new Error("invalid current trick");
  const seen = new Set();
  for (const seat of SEATS) {
    if (!Array.isArray(input.hands[seat])) throw new Error(`missing ${seat} hand`);
    for (const card of input.hands[seat]) {
      if (!validCard(card) || seen.has(card)) throw new Error("invalid or duplicate card");
      seen.add(card);
    }
  }
  for (const play of trick) {
    if (!play || !SEATS.includes(play.seat) || !validCard(play.card) || seen.has(play.card)) throw new Error("invalid current trick card");
    seen.add(play.card);
  }
  if (trick.length) {
    const first = SEATS.indexOf(trick[0].seat);
    for (let i = 0; i < trick.length; i++) if (trick[i].seat !== SEATS[(first + i) % 4]) throw new Error("current trick is out of order");
    if (input.turn !== SEATS[(first + trick.length) % 4]) throw new Error("turn does not match current trick");
  }
  if (!input.hands[input.turn].length) throw new Error("turn hand is empty");
  return trick;
}

function pbnHand(cards) {
  return SUITS.map((suit) => cards.filter((card) => card[0] === suit).map((card) => card[1]).join("")).join(".");
}

function legalCards(hand, trick) {
  if (!trick.length) return hand;
  const follow = hand.filter((card) => card[0] === trick[0].card[0]);
  return follow.length ? follow : hand;
}

function solve(input) {
  const trick = validate(input);
  const firstSeat = trick.length ? trick[0].seat : input.turn;
  const deal = {
    trump: TRUMPS[input.contract.strain],
    first: SEATS.indexOf(firstSeat),
    currentTrickSuit: trick.map((play) => SUITS.indexOf(play.card[0])),
    currentTrickRank: trick.map((play) => RANKS.indexOf(play.card[1]) + 2),
    remainCards: `N:${SEATS.map((seat) => pbnHand(input.hands[seat])).join(" ")}`
  };
  const result = dds.SolveBoardPBN(deal, -1, 3, 0);
  const legal = new Set(legalCards(input.hands[input.turn], trick));
  for (let i = 0; i < result.cards; i++) {
    const rank = RANKS[result.rank[i] - 2];
    const card = `${SUITS[result.suit[i]]}${rank ?? ""}`;
    if (legal.has(card)) return { card, engine: "dds", score: result.score[i], nodes: result.nodes };
  }
  throw new Error("DDS returned no legal card");
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") return json(res, 200, { ok: true, engine: "DDS" });
  if (req.method !== "POST" || !["/solve", "/analyze"].includes(req.url)) return json(res, 404, { error: "Not found" });
  if (!authorized(req)) return json(res, 401, { error: "Unauthorized" });
  let size = 0; const chunks = [];
  req.on("data", (chunk) => {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) req.destroy(); else chunks.push(chunk);
  });
  req.on("end", async () => {
    if (size > MAX_BODY_BYTES) return;
    try {
      const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const analysisRequest = req.url === "/analyze" || input?.action === "analyze";
      json(res, 200, analysisRequest ? { analysis: await analyzeDeal(dds, input) } : solve(input));
    } catch (error) {
      json(res, 400, { error: error instanceof Error ? error.message : "Invalid request" });
    }
  });
});

server.listen(PORT, "0.0.0.0", () => console.log(`MiniBridge DDS service listening on port ${PORT}`));
