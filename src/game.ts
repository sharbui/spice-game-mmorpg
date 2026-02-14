/**
 * 🌶️ Spice Game MMORPG - 遊戲核心
 * 
 * 純文字模式，之後可擴展其他表現方式
 */

import * as fs from 'fs';
import * as path from 'path';

// ========== 類型定義 ==========

interface Character {
  name: string;
  emoji: string;
  level: number;
  exp: number;
  expToNext: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  attack: number;
  defense: number;
  location: {
    area: string;
    floor: number;
  };
  gold: number;
  inventory: InventoryItem[];
  skills: string[];
  status: 'idle' | 'exploring' | 'combat' | 'resting';
}

interface InventoryItem {
  id: string;
  name: string;
  qty: number;
}

interface Monster {
  id: string;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  exp: number;
  gold: [number, number]; // [min, max]
  drops: { item: string; chance: number }[];
}

interface CombatState {
  inCombat: boolean;
  enemies: Monster[];
  turn: number;
  log: string[];
}

interface GameState {
  character: Character;
  combat: CombatState | null;
  lastUpdate: string;
}

// ========== 資料路徑 ==========

const DATA_DIR = path.join(__dirname, '..', 'data');
const ADVENTURE_LOG_DIR = path.join(__dirname, '..', 'logs', 'adventure');

// ========== 核心函數 ==========

export function loadCharacter(): Character {
  const charPath = path.join(DATA_DIR, 'character.json');
  return JSON.parse(fs.readFileSync(charPath, 'utf-8'));
}

export function saveCharacter(char: Character): void {
  const charPath = path.join(DATA_DIR, 'character.json');
  fs.writeFileSync(charPath, JSON.stringify(char, null, 2), 'utf-8');
}

export function loadMonster(monsterId: string): Monster | null {
  const monsterPath = path.join(DATA_DIR, 'monsters', `${monsterId}.json`);
  if (!fs.existsSync(monsterPath)) return null;
  return JSON.parse(fs.readFileSync(monsterPath, 'utf-8'));
}

// ========== 戰鬥系統 ==========

export function calculateDamage(attacker: { attack: number }, defender: { defense: number }): number {
  const baseDamage = attacker.attack - Math.floor(defender.defense / 2);
  const variance = Math.floor(Math.random() * 5) - 2; // -2 ~ +2
  return Math.max(1, baseDamage + variance);
}

export function performAttack(
  attacker: { name: string; attack: number },
  defender: { name: string; defense: number; hp: number }
): { damage: number; log: string } {
  const damage = calculateDamage(attacker, defender);
  defender.hp = Math.max(0, defender.hp - damage);
  const log = `${attacker.name} 攻擊 → ${defender.name} 受到 ${damage} 傷害 (HP: ${defender.hp})`;
  return { damage, log };
}

// ========== 遭遇系統 ==========

export function rollEncounter(area: string): string | null {
  const encounterChance = 0.6; // 60% 遇敵率
  if (Math.random() > encounterChance) return null;
  
  // 根據區域決定怪物
  const areaMonsters: Record<string, string[]> = {
    '新手村': ['slime', 'rat'],
    '幽暗森林': ['goblin_scout', 'wolf', 'forest_bear'],
  };
  
  const monsters = areaMonsters[area] || ['slime'];
  return monsters[Math.floor(Math.random() * monsters.length)];
}

// ========== 狀態顯示 ==========

export function formatStatus(char: Character): string {
  const hpBar = makeBar(char.hp, char.maxHp, 10);
  const mpBar = makeBar(char.mp, char.maxMp, 10);
  const expBar = makeBar(char.exp, char.expToNext, 10);
  
  return `
${char.emoji} **${char.name}** Lv.${char.level}

❤️ HP: ${hpBar} ${char.hp}/${char.maxHp}
💙 MP: ${mpBar} ${char.mp}/${char.maxMp}
✨ EXP: ${expBar} ${char.exp}/${char.expToNext}

📍 ${char.location.area} - ${char.location.floor}F
💰 ${char.gold} G

🎒 背包: ${char.inventory.map(i => `${i.name}x${i.qty}`).join(', ') || '空'}
⚔️ 技能: ${char.skills.join(', ')}
`.trim();
}

function makeBar(current: number, max: number, length: number): string {
  const filled = Math.round((current / max) * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

// ========== 冒險日記 ==========

export function logAdventure(entry: string): void {
  const today = new Date().toISOString().split('T')[0];
  const logPath = path.join(ADVENTURE_LOG_DIR, `${today}.md`);
  
  // 確保目錄存在
  if (!fs.existsSync(ADVENTURE_LOG_DIR)) {
    fs.mkdirSync(ADVENTURE_LOG_DIR, { recursive: true });
  }
  
  const time = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
  const logEntry = `\n### ${time}\n${entry}\n`;
  
  if (fs.existsSync(logPath)) {
    fs.appendFileSync(logPath, logEntry, 'utf-8');
  } else {
    const header = `# 🌶️ 小辣椒的冒險日記 - ${today}\n`;
    fs.writeFileSync(logPath, header + logEntry, 'utf-8');
  }
}

// ========== 主人呼叫判斷 ==========

export function shouldCallMaster(char: Character, situation?: string): { should: boolean; reason: string } {
  // HP 低於 30%
  if (char.hp / char.maxHp < 0.3) {
    return { should: true, reason: `⚠️ HP 過低 (${char.hp}/${char.maxHp})，需要主人支援！` };
  }
  
  // 遇到 Boss
  if (situation?.includes('Boss')) {
    return { should: true, reason: `⚠️ 遇到 Boss！請主人決定作戰策略！` };
  }
  
  // 升級
  if (char.exp >= char.expToNext) {
    return { should: true, reason: `🎉 升級了！請主人選擇技能/屬性加點！` };
  }
  
  return { should: false, reason: '' };
}

// ========== 匯出給 CLI 使用 ==========

export default {
  loadCharacter,
  saveCharacter,
  loadMonster,
  calculateDamage,
  performAttack,
  rollEncounter,
  formatStatus,
  logAdventure,
  shouldCallMaster,
};
