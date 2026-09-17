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
  RARE:        ["Isagi", "Kurona", "Gagamaru", "Chigiri", "Raichi"],
  EPIC:        ["Otoya", "Hiori", "Bachira", "Karasu"],
  LEGENDARY:   ["Kiyora", "Nagi", "Aiku", "King", "Kunigami"],
  MYTHIC:      ["Shidou", "Ness", "Reo", "Rin", "Niko", "Charles", "Yukimiya"],
  WORLDCLASS:  ["Sae", "Kaiser", "Don Lorenzo"],
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

// ─────────────────────────────────────────────
// Rarity / character select (shared)
// ─────────────────────────────────────────────

function raritySelect(prefix, sessionId, position) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${prefix}_rarity:${sessionId}:${position}`)
      .setPlaceholder("Choose a character rarity")
      .addOptions(RARITY_KEYS.map((r) => ({ label: r, value: r })))
  );
}

function charSelect(prefix, sessionId, position, rarity) {
  const chars = RARITY_CHARACTERS[rarity] ?? [];
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${prefix}_char:${sessionId}:${position}`)
      .setPlaceholder(`Choose your character from ${rarity}`)
      .addOptions(chars.map((c) => ({ label: c, value: c })))
  );
}

// ═══════════════════════════════════════════
//  SCRIM
// ═══════════════════════════════════════════

function buildScrimContent(session) {
  const lines = ["# Scrim!", "**Choose your position**", ""];
  for (const pos of POSITIONS) {
    const e = session.positions[pos];
    if (e) {
      const char = e.character ? ` (${e.character})` : " (Choosing character...)";
      lines.push(`**${pos} :** <@${e.userId}>${char}`);
    } else {
      lines.push(`**${pos} :**`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function buildScrimComponents(sessionId, session) {
  const posSelect = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`scrim_pos:${sessionId}`)
      .setPlaceholder("...Choose a position")
      .addOptions(POSITIONS.map((p) => ({ label: p, value: p })))
  );
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`scrim_changechar:${sessionId}`).setLabel("Change Character").setEmoji("🔄").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`scrim_leave:${sessionId}`).setLabel("Leave Position").setEmoji("🚪").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`scrim_kick:${sessionId}`).setLabel("Kick Player").setStyle(ButtonStyle.Danger)
  );
  return [posSelect, buttons];
}

function buildScrimKickMenu(sessionId, session) {
  const opts = POSITIONS.filter((p) => session.positions[p] !== null).map((p) => {
    const e = session.positions[p];
    return { label: `${p}: ${e.username}`, value: `${p}:${e.userId}` };
  });
  if (!opts.length...
