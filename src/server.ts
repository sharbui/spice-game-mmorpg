/**
 * 🌶️ Spice Game Server
 * 
 * REST API 服務端
 * - GET  /status         角色狀態
 * - POST /explore        探索
 * - POST /attack         攻擊
 * - POST /flee           逃跑
 * - POST /rest           休息
 * - POST /turn           執行一回合 (heartbeat)
 * - GET  /log/:date      取得冒險日記
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const LOGS_DIR = path.join(__dirname, '..', 'logs', 'adventure');
const PORT = process.env.SPICE_GAME_PORT || 3737;

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

interface GameResponse {
  success: boolean;
  message: string;
  data?: any;
  needMaster?: boolean;
  masterReason?: string;
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
  return { ...data, hp: data.maxHp };
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
  
  const time = new Date().toLocaleTimeString('zh-TW', { 
    hour: '2-digit', 
    minute: '2-digit',
    timeZone: 'Asia/Taipei'
  });
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

// ========== 遊戲指令 ==========

function cmdStatus(): GameResponse {
  const char = loadCharacter();
  const combat = loadCombat();
  
  let message = `
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
    message += `\n\n⚔️ **戰鬥中！** vs ${combat.enemy.name} (HP: ${combat.enemy.hp}/${combat.enemy.maxHp})`;
  }
  
  return { 
    success: true, 
    message,
    data: { character: char, combat }
  };
}

function cmdExplore(): GameResponse {
  const char = loadCharacter();
  const combat = loadCombat();
  
  if (combat) {
    return { success: false, message: '⚠️ 戰鬥中無法探索！請先結束戰鬥。' };
  }
  
  if (char.hp <= 0) {
    return { success: false, message: '💀 HP 為 0，無法行動！請先休息。' };
  }
  
  if (Math.random() < 0.6) {
    const monsters = char.location.area === '新手村' ? ['slime'] : ['slime', 'goblin_scout'];
    const monsterId = monsters[Math.floor(Math.random() * monsters.length)];
    const monster = loadMonster(monsterId);
    
    if (!monster) {
      return { success: false, message: `❌ 找不到怪物資料: ${monsterId}` };
    }
    
    char.status = 'combat';
    saveCharacter(char);
    saveCombat({ enemy: monster, turn: 1 });
    
    const msg = `⚔️ 遭遇 **${monster.name}** Lv.${monster.level}！\n\nHP: ${monster.hp}/${monster.maxHp}\nATK: ${monster.attack} / DEF: ${monster.defense}`;
    log(`> 遭遇 **${monster.name}** Lv.${monster.level}`);
    
    return { 
      success: true, 
      message: msg,
      data: { enemy: monster }
    };
  } else {
    const events = [
      { msg: '🌿 在草叢中發現了 10 金幣！', gold: 10 },
      { msg: '🍃 什麼都沒發現...', gold: 0 },
      { msg: '🌸 欣賞了美麗的風景', gold: 0 },
      { msg: '🦋 一隻蝴蝶飛過', gold: 0 },
    ];
    const event = events[Math.floor(Math.random() * events.length)];
    
    if (event.gold > 0) {
      char.gold += event.gold;
      saveCharacter(char);
    }
    
    log(`> ${event.msg}`);
    return { success: true, message: event.msg };
  }
}

function cmdAttack(): GameResponse {
  const char = loadCharacter();
  const combat = loadCombat();
  
  if (!combat) {
    return { success: false, message: '❌ 目前沒有戰鬥，先去探索吧！' };
  }
  
  const enemy = combat.enemy;
  let battleLog = `**回合 ${combat.turn}**\n\n`;
  let needMaster = false;
  let masterReason = '';
  
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
      battleLog += `\n\n🎉 **升級！** Lv.${char.level}`;
      needMaster = true;
      masterReason = `🎉 升級到 Lv.${char.level}！請選擇技能/屬性加點！`;
    }
    
    saveCharacter(char);
    saveCombat(null);
    log(battleLog);
    
    return { 
      success: true, 
      message: battleLog,
      data: { victory: true, exp: enemy.exp, gold: goldDrop },
      needMaster,
      masterReason
    };
  }
  
  // 敵人攻擊
  const enemyDmg = calcDamage(enemy.attack, char.defense);
  char.hp = Math.max(0, char.hp - enemyDmg);
  battleLog += `${enemy.name} 反擊 → ${char.emoji} 受到 ${enemyDmg} 傷害 (HP: ${char.hp})\n`;
  
  // 檢查玩家死亡
  if (char.hp <= 0) {
    char.status = 'dead';
    battleLog += `\n💀 **戰敗...**`;
    saveCharacter(char);
    saveCombat(null);
    log(battleLog);
    
    return { 
      success: true, 
      message: battleLog,
      data: { defeat: true },
      needMaster: true,
      masterReason: '💀 戰敗了！需要主人救援！'
    };
  }
  
  // 檢查是否需要呼叫主人
  if (char.hp / char.maxHp < 0.3) {
    needMaster = true;
    masterReason = `⚠️ HP 過低 (${char.hp}/${char.maxHp})！建議使用藥水或逃跑！`;
  }
  
  combat.turn += 1;
  combat.enemy = enemy;
  saveCharacter(char);
  saveCombat(combat);
  log(battleLog);
  
  return { 
    success: true, 
    message: battleLog,
    data: { combat },
    needMaster,
    masterReason
  };
}

function cmdFlee(): GameResponse {
  const char = loadCharacter();
  const combat = loadCombat();
  
  if (!combat) {
    return { success: false, message: '❌ 沒有戰鬥可以逃跑' };
  }
  
  if (Math.random() < 0.5) {
    char.status = 'idle';
    saveCharacter(char);
    saveCombat(null);
    log('> 🏃 成功逃跑！');
    return { success: true, message: '🏃 成功逃跑！' };
  } else {
    const enemyDmg = calcDamage(combat.enemy.attack, char.defense);
    char.hp = Math.max(0, char.hp - enemyDmg);
    saveCharacter(char);
    
    const msg = `🏃❌ 逃跑失敗！被 ${combat.enemy.name} 攻擊，受到 ${enemyDmg} 傷害 (HP: ${char.hp})`;
    log(`> ${msg}`);
    
    return { 
      success: true, 
      message: msg,
      needMaster: char.hp / char.maxHp < 0.3,
      masterReason: char.hp / char.maxHp < 0.3 ? `⚠️ HP 危險！(${char.hp}/${char.maxHp})` : undefined
    };
  }
}

function cmdRest(): GameResponse {
  const char = loadCharacter();
  const combat = loadCombat();
  
  if (combat) {
    return { success: false, message: '⚠️ 戰鬥中無法休息！' };
  }
  
  const hpRecover = Math.floor(char.maxHp * 0.3);
  const mpRecover = Math.floor(char.maxMp * 0.2);
  
  char.hp = Math.min(char.maxHp, char.hp + hpRecover);
  char.mp = Math.min(char.maxMp, char.mp + mpRecover);
  char.status = 'idle';
  saveCharacter(char);
  
  const msg = `💤 休息中...\n❤️ HP +${hpRecover} (${char.hp}/${char.maxHp})\n💙 MP +${mpRecover} (${char.mp}/${char.maxMp})`;
  log(`> 休息恢復 HP+${hpRecover} MP+${mpRecover}`);
  
  return { success: true, message: msg };
}

function cmdTurn(): GameResponse {
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

function getLog(date: string): GameResponse {
  const logPath = path.join(LOGS_DIR, `${date}.md`);
  if (!fs.existsSync(logPath)) {
    return { success: false, message: `找不到 ${date} 的冒險日記` };
  }
  const content = fs.readFileSync(logPath, 'utf-8');
  return { success: true, message: content };
}

// ========== HTTP Server ==========

const routes: Record<string, Record<string, () => GameResponse>> = {
  GET: {
    '/status': cmdStatus,
    '/health': () => ({ success: true, message: 'OK' }),
  },
  POST: {
    '/explore': cmdExplore,
    '/attack': cmdAttack,
    '/flee': cmdFlee,
    '/rest': cmdRest,
    '/turn': cmdTurn,
  }
};

const server = http.createServer((req, res) => {
  const method = req.method || 'GET';
  const url = req.url || '/';
  
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  // 處理冒險日記路由
  if (method === 'GET' && url.startsWith('/log/')) {
    const date = url.slice(5);
    const result = getLog(date);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.writeHead(result.success ? 200 : 404);
    res.end(JSON.stringify(result));
    return;
  }
  
  // 一般路由
  const handler = routes[method]?.[url];
  if (handler) {
    try {
      const result = handler();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.writeHead(200);
      res.end(JSON.stringify(result));
    } catch (err: any) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.writeHead(500);
      res.end(JSON.stringify({ success: false, message: err.message }));
    }
  } else {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.writeHead(404);
    res.end(JSON.stringify({ success: false, message: 'Not Found' }));
  }
});

server.listen(PORT, () => {
  console.log(`🌶️ Spice Game Server running on http://localhost:${PORT}`);
  console.log(`
Available endpoints:
  GET  /status    - 角色狀態
  GET  /health    - 健康檢查
  POST /explore   - 探索
  POST /attack    - 攻擊
  POST /flee      - 逃跑
  POST /rest      - 休息
  POST /turn      - 自動一回合
  GET  /log/:date - 冒險日記 (e.g. /log/2026-02-15)
`);
});
