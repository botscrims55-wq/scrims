// ============================================================
// Blue Lock Rivals Discord Bot — Railway-ready standalone
// Commands: /scrim  /inhouse  /tryout
// ============================================================
// Required env vars:
//   DISCORD_TOKEN      — bot token
//   DISCORD_CLIENT_ID  — application / client ID
// ============================================================

import {
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} from "discord.js";
import { createServer } from "http";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const POSITIONS        = ["CF", "RW", "LW", "CM", "GK"];
const TEAMS            = ["HOME", "AWAY"];
const TRYOUT_DURATION  = 10 * 60 * 1000;

const RARITY_CHARACTERS = {
 RARE:        ["Isagi", "kurona", "Gagamaru", "Chigiri", "Raichi"],
  EPIC:        ["Otoya", "Hirori", "Bachira", "Karasu"],
  LEGENDARY:   ["Kunigami", "Kiyora", "Aiku", "Nagi", "King"],
  MYTHIC:      ["Shidou", "Reo", "Niko", "Rin", "Charles", "Yukimiya", "Ness"],
  WORLDCLASS:  ["Sae", "Don Lorenzo", "Kaiser"],
  MASTERCLASS: ["Loki", "Lavinho"],
  LIMITEDS: [
    "Elf Emperor", "Easter Yukimiya", "Reaper Sae", "Skeleton Nagi",
    "Phantom Isagi", "Demon Shidou", "Firework Bachira",
    "Subzero Loki", "Krampus Barou",
  ],
};
const RARITY_KEYS = Object.keys(RARITY_CHARACTERS);

// ─────────────────────────────────────────────
// In-memory session stores
// ─────────────────────────────────────────────

const activeScrims    = new Map(); // messageId → ScrimSession
const channelScrim    = new Map(); // channelId → messageId

const activeInhouses  = new Map(); // messageId → InhouseSession
const channelInhouse  = new Map(); // channelId → messageId

const activeTryouts   = new Map(); // messageId → TryoutSession
const channelTryout   = new Map(); // channelId → messageId

// ─────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────

function emptyTeam() {
  return { CF: null, RW: null, LW: null, CM: null, GK: null };
}

function findPlayerInTeams(session, userId) {
  for (const team of TEAMS)
    for (const pos of POSITIONS)
      if (session.teams[team][pos]?.userId === userId)
        return { team, position: pos };
  return null;
}

function clearTimer(session) {
  if (session.timer) { clearTimeout(session.timer); session.timer = null; }
}
