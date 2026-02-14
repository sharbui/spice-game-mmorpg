# 🎮 Spice Game - 設計文件

## 核心架構

### 1. Heartbeat 回合系統

每次 heartbeat 觸發時：
1. 檢查角色狀態
2. 執行自動行動（探索/戰鬥/休息）
3. 更新冒險日記
4. 判斷是否需要呼叫主人

```
HEARTBEAT.md 加入：
- [ ] 執行 spice-game 回合
```

### 2. 主人呼叫機制

觸發條件：
- HP < 30% 且沒有藥水
- 遇到 Boss
- 重要劇情選擇
- 背包滿了
- 升級選技能

通知方式：Telegram 訊息 + inline buttons

### 3. 通訊介面 (Telegram 優先)

指令模式：
- `/status` — 查看角色狀態
- `/inventory` — 查看背包
- `/attack` — 攻擊
- `/skill <name>` — 使用技能
- `/flee` — 逃跑
- `/rest` — 休息

Inline Buttons 快捷：
```
[⚔️ 攻擊] [🛡️ 防禦] [💊 使用藥水]
[🏃 逃跑] [✨ 技能]
```

## 冒險日記格式

存放位置：`memory/adventure/YYYY-MM-DD.md`

```markdown
# 🌶️ 小辣椒的冒險日記 - 2026-02-15

## 角色狀態
- **等級:** 5
- **HP:** 45/100
- **MP:** 20/50
- **位置:** 幽暗森林 - 第3層
- **金幣:** 1,250

## 今日冒險

### 02:30 - 遭遇戰鬥
> 遇到了 **哥布林斥候** x2
> 
> 回合 1: 小辣椒 使用「火焰彈」→ 哥布林A 受到 25 傷害
> 回合 2: 哥布林A 攻擊 → 小辣椒 受到 8 傷害
> 回合 3: 小辣椒 普攻 → 哥布林A 倒下！
> ...
> 
> ✅ 戰鬥勝利！
> 獲得：經驗值 +50, 金幣 +30, 哥布林耳朵 x2

### 02:45 - 發現寶箱
> 在樹洞裡發現寶箱
> 獲得：小型生命藥水 x1

### 03:00 - 呼叫主人
> ⚠️ 遇到 **森林巨熊 (Boss)**
> HP 不足，請求主人支援！
> 
> 主人決定：使用技能「爆裂火焰」
> Boss 受到 150 傷害！
```

## 資料結構

### 角色 (character.json)
```json
{
  "name": "小辣椒",
  "level": 5,
  "exp": 450,
  "expToNext": 500,
  "hp": 45,
  "maxHp": 100,
  "mp": 20,
  "maxMp": 50,
  "attack": 15,
  "defense": 8,
  "location": {
    "area": "幽暗森林",
    "floor": 3
  },
  "gold": 1250,
  "inventory": [],
  "skills": ["火焰彈", "治療術"],
  "status": "exploring"
}
```

### 怪物 (monsters/*.json)
```json
{
  "id": "goblin_scout",
  "name": "哥布林斥候",
  "level": 3,
  "hp": 40,
  "attack": 8,
  "defense": 3,
  "exp": 25,
  "gold": [10, 20],
  "drops": [
    { "item": "goblin_ear", "chance": 0.5 }
  ]
}
```

## 開發階段

### Phase 1 - 基礎系統
- [ ] 角色狀態管理
- [ ] 簡單戰鬥系統
- [ ] 冒險日記記錄
- [ ] Telegram 指令介面

### Phase 2 - 世界擴展
- [ ] 地圖系統
- [ ] 更多怪物
- [ ] 道具/裝備系統
- [ ] 技能樹

### Phase 3 - 進階功能
- [ ] 劇情/任務系統
- [ ] Boss 戰
- [ ] 成就系統
- [ ] 多角色？
