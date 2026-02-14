#!/usr/bin/env node
/**
 * 🌶️ Spice Game CLI
 * 
 * 用法:
 *   tsx src/cli.ts status    - 查看角色狀態
 *   tsx src/cli.ts explore   - 探索 (可能遇敵)
 *   tsx src/cli.ts turn      - 執行一回合 (heartbeat 用)
 *   tsx src/cli.ts attack    - 攻擊 (戰鬥中)
 *   tsx src/cli.ts flee      - 逃跑 (戰鬥中)
 *   tsx src/cli.ts rest      - 休息回復 HP
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const LOGS_DIR = path.join(__dirname, '..', 'logs', 'adventure');

// ========== 類型 ==========

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
  location: { area: string; floor: number };
  gold: number;
  inventory: { id: string; name: string; qty: number }[];
  skills: string[];
  status: string;
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
  gold: [number, number];
  drops: { item: string; chance: number }[];
}

interface CombatState {
  enemy: Monster;
  turn: number;
}

// ========== 資料操作 ==========

function loadCharacter(): Character {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'character.json'), 'utf-8'));
}

function saveCharacter(char: Character): void {
  fs.writeFileSync(path.join(DATA_DIR, 'character.json'), JSON.stringify(char, null, 2), 'utf-8');
}

function loadCombat(): CombatState | null {
  const combatPath = path.join(DATA_DIR, 'combat.json');
  if (!fs.existsSync(combatPath)) return null;
  return JSON.parse(fs.readFileSync(combatPath, 'utf-8'));
}

function saveCombat(combat: CombatState | null): void {
  const combatPath = path.join(DATA_DIR, 'combat.json');
  if (combat === null) {
    if (fs.existsSync(combatPath)) fs.unlinkSync(combatPath);
  } else {
    fs.writeFileSync(combatPath, JSON.stringify(combat, null, 2), 'utf-8');
  }
}

function loadMonster(id: string): Monster | null {
  const monsterPath = path.join(DATA_DIR, 'monsters', `${id}.json`);
  if (!fs.existsSync(monsterPath)) return null;
  const data = JSON.parse(fs.readFileSync(monsterPath, 'utf-8'));
  return { ...data, hp: data.maxHp }; // 重置 HP
}

// ========== 工具函數 ==========

function makeBar(current: number, max: number, len = 10): string {
  const filled = Math.round((current / max) * len);
  return '█'.repeat(filled) + '░'.repeat(len - filled);
}

function log(entry: string): void {
  const today = new Date().toISOString().split('T')[0];
  const logPath = path.join(LOGS_DIR, `${today}.md`);
  
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
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

function calcDamage(atk: number, def: number): number {
  const base = atk - Math.floor(def / 2);
  const variance = Math.floor(Math.random() * 5) - 2;
  return Math.max(1, base + variance);
}

// ========== 指令實作 ==========

function cmdStatus(): string {
  const char = loadCharacter();
  const combat = loadCombat();
  
  let output = `
${char.emoji} **${char.name}** Lv.${char.level}

❤️ HP: ${makeBar(char.hp, char.maxHp)} ${char.hp}/${char.maxHp}
💙 MP: ${makeBar(char.mp, char.maxMp)} ${char.mp}/${char.maxMp}
✨ EXP: ${makeBar(char.exp, char.expToNext)} ${char.exp}/${char.expToNext}

📍 ${char.location.area} - ${char.location.floor}F
💰 ${char.gold} G
🎒 ${char.inventory.map(i => `${i.name}x${i.qty}`).join(', ') || '空'}
📊 狀態: ${char.status}
`.trim();

  if (combat) {
    output += `\n\n⚔️ **戰鬥中！** vs ${combat.enemy.name} (HP: ${combat.enemy.hp}/${combat.enemy.maxHp})`;
  }
  
  return output;
}

function cmdExplore(): string {
  const char = loadCharacter();
  const combat = loadCombat();
  
  if (combat) {
    return '⚠️ 戰鬥中無法探索！請先結束戰鬥。';
  }
  
  if (char.hp <= 0) {
    return '💀 HP 為 0，無法行動！請先休息。';
  }
  
  // 60% 機率遇敵
  if (Math.random() < 0.6) {
    const monsters = char.location.area === '新手村' ? ['slime'] : ['slime', 'goblin_scout'];
    const monsterId = monsters[Math.floor(Math.random() * monsters.length)];
    const monster = loadMonster(monsterId);
    
    if (!monster) {
      return `❌ 找不到怪物資料: ${monsterId}`;
    }
    
    char.status = 'combat';
    saveCharacter(char);
    saveCombat({ enemy: monster, turn: 1 });
    
    const msg = `⚔️ 遭遇 **${monster.name}** Lv.${monster.level}！\n\nHP: ${monster.hp}/${monster.maxHp}\nATK: ${monster.attack} / DEF: ${monster.defense}\n\n輸入 attack 攻擊 或 flee 逃跑`;
    log(`> 遭遇 **${monster.name}** Lv.${monster.level}`);
    return msg;
  } else {
    // 沒遇到怪
    const events = [
      '🌿 在草叢中發現了 10 金幣！',
      '🍃 什麼都沒發現...',
      '🌸 欣賞了美麗的風景',
      '🦋 一隻蝴蝶飛過',
    ];
    const event = events[Math.floor(Math.random() * events.length)];
    
    if (event.includes('金幣')) {
      char.gold += 10;
      saveCharacter(char);
    }
    
    log(`> ${event}`);
    return event;
  }
}

function cmdAttack(): string {
  const char = loadCharacter();
  const combat = loadCombat();
  
  if (!combat) {
    return '❌ 目前沒有戰鬥，先去探索吧！';
  }
  
  const enemy = combat.enemy;
  let battleLog = `**回合 ${combat.turn}**\n\n`;
  
  // 玩家攻擊
  const playerDmg = calcDamage(char.attack, enemy.defense);
  enemy.hp = Math.max(0, enemy.hp - playerDmg);
  battleLog += `${char.emoji} 攻擊 → ${enemy.name} 受到 ${playerDmg} 傷害 (HP: ${enemy.hp})\n`;
  
  // 檢查敵人死亡
  if (enemy.hp <= 0) {
    const goldDrop = enemy.gold[0] + Math.floor(Math.random() * (enemy.gold[1] - enemy.gold[0] + 1));
    char.exp += enemy.exp;
    char.gold += goldDrop;
    char.status = 'idle';
    
    battleLog += `\n✅ **勝利！**\n獲得: EXP +${enemy.exp}, 金幣 +${goldDrop}`;
    
    // 檢查升級
    if (char.exp >= char.expToNext) {
      char.level += 1;
      char.exp -= char.expToNext;
      char.expToNext = Math.floor(char.expToNext * 1.5);
      char.maxHp += 10;
      char.hp = char.maxHp;
      char.maxMp += 5;
      char.mp = char.maxMp;
      char.attack += 2;
      char.defense += 1;
      battleLog += `\n\n🎉 **升級！** Lv.${char.level}\nHP/MP 全回復，能力提升！`;
    }
    
    saveCharacter(char);
    saveCombat(null);
    log(battleLog);
    return battleLog;
  }
  
  // 敵人攻擊
  const enemyDmg = calcDamage(enemy.attack, char.defense);
  char.hp = Math.max(0, char.hp - enemyDmg);
  battleLog += `${enemy.name} 反擊 → ${char.emoji} 受到 ${enemyDmg} 傷害 (HP: ${char.hp})\n`;
  
  // 檢查玩家死亡
  if (char.hp <= 0) {
    char.status = 'dead';
    battleLog += `\n💀 **戰敗...**\n需要休息恢復`;
    saveCharacter(char);
    saveCombat(null);
    log(battleLog);
    return battleLog;
  }
  
  // 檢查是否需要呼叫主人
  if (char.hp / char.maxHp < 0.3) {
    battleLog += `\n⚠️ **HP 過低！建議呼叫主人支援或使用藥水！**`;
  }
  
  combat.turn += 1;
  combat.enemy = enemy;
  saveCharacter(char);
  saveCombat(combat);
  log(battleLog);
  
  return battleLog;
}

function cmdFlee(): string {
  const char = loadCharacter();
  const combat = loadCombat();
  
  if (!combat) {
    return '❌ 沒有戰鬥可以逃跑';
  }
  
  // 50% 機率逃跑成功
  if (Math.random() < 0.5) {
    char.status = 'idle';
    saveCharacter(char);
    saveCombat(null);
    log('> 🏃 成功逃跑！');
    return '🏃 成功逃跑！';
  } else {
    // 逃跑失敗，被打一下
    const enemyDmg = calcDamage(combat.enemy.attack, char.defense);
    char.hp = Math.max(0, char.hp - enemyDmg);
    saveCharacter(char);
    
    const msg = `🏃❌ 逃跑失敗！被 ${combat.enemy.name} 攻擊，受到 ${enemyDmg} 傷害 (HP: ${char.hp})`;
    log(`> ${msg}`);
    return msg;
  }
}

function cmdRest(): string {
  const char = loadCharacter();
  const combat = loadCombat();
  
  if (combat) {
    return '⚠️ 戰鬥中無法休息！';
  }
  
  const hpRecover = Math.floor(char.maxHp * 0.3);
  const mpRecover = Math.floor(char.maxMp * 0.2);
  
  char.hp = Math.min(char.maxHp, char.hp + hpRecover);
  char.mp = Math.min(char.maxMp, char.mp + mpRecover);
  char.status = 'idle';
  saveCharacter(char);
  
  const msg = `💤 休息中...\n❤️ HP +${hpRecover} (${char.hp}/${char.maxHp})\n💙 MP +${mpRecover} (${char.mp}/${char.maxMp})`;
  log(`> 休息恢復 HP+${hpRecover} MP+${mpRecover}`);
  return msg;
}

function cmdTurn(): string {
  // Heartbeat 用：自動執行一回合
  const char = loadCharacter();
  const combat = loadCombat();
  
  if (char.hp <= 0) {
    return cmdRest();
  }
  
  if (combat) {
    return cmdAttack();
  }
  
  return cmdExplore();
}

// ========== 主程式 ==========

const command = process.argv[2] || 'status';

const commands: Record<string, () => string> = {
  status: cmdStatus,
  explore: cmdExplore,
  attack: cmdAttack,
  flee: cmdFlee,
  rest: cmdRest,
  turn: cmdTurn,
};

if (commands[command]) {
  console.log(commands[command]());
} else {
  console.log(`未知指令: ${command}\n可用: ${Object.keys(commands).join(', ')}`);
}
