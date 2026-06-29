export enum GameState {
  TITLE = 'TITLE',
  OPTIONS = 'OPTIONS',
  PLAYING = 'PLAYING',
  GAMEOVER = 'GAMEOVER',
  ENDING = 'ENDING'
}

export interface ControlSettings {
  moveUp: string;
  moveDown: string;
  moveLeft: string;
  moveRight: string;
  attack: string;
  skill: string;
}

export const DEFAULT_CONTROLS: ControlSettings = {
  moveUp: 'KeyW',
  moveDown: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  attack: 'KeyP',
  skill: 'KeyO'
};

export const ALTERNATIVE_CONTROLS: ControlSettings = {
  moveUp: 'ArrowUp',
  moveDown: 'ArrowDown',
  moveLeft: 'ArrowLeft',
  moveRight: 'ArrowRight',
  attack: 'KeyP',
  skill: 'KeyO'
};

export interface GameStats {
  hp: number;
  maxHp: number;
  score: number;
  kills: number;
  skillCooldown: number; // 0 to 1 percentage or seconds remaining
  skillMaxCooldown: number;
  bossDefeated: boolean;
}

export interface DialogueLine {
  speaker: 'Player' | 'NPC';
  text: string;
}

export const ENDING_DIALOGUE: DialogueLine[] = [
  { speaker: 'NPC', text: 'โอ้! ท่านผู้กล้า! ในที่สุดท่านก็สามารถปราบปีศาจยักษ์ใหญ่ตัวนั้นลงได้สำเร็จ!' },
  { speaker: 'Player', text: 'มันเป็นไฟต์ที่ท้าทายมาก แต่ข้าก็ทำสำเร็จจนได้ เพื่อความสงบสุขของพวกเรา' },
  { speaker: 'NPC', text: 'พลังระเบิดวงแหวนศักดิ์สิทธิ์ของท่าน ช่างงดงามและทรงพลังเหลือเกิน' },
  { speaker: 'Player', text: 'ขอบคุณท่านมาก ยาเติมพลังโพชั่นที่ตกอยู่ทั่วแผนที่ก็ช่วยข้าไว้ได้มากทีเดียว' },
  { speaker: 'NPC', text: 'พวกเราทุกคนติดหนี้บุญคุณท่านอย่างยิ่ง หมู่บ้านแห่งนี้จะกลับมาร่มเย็นเป็นสุขอีกครั้ง' },
  { speaker: 'Player', text: 'นั่นคือสิ่งที่ข้าหวังไว้ จากนี้พวกท่านก็ไม่ต้องหวาดกลัวอัคคีภัยจากบอสอีกแล้ว' },
  { speaker: 'NPC', text: 'เชิญท่านผู้กล้าพักผ่อนและรับการยกย่องจากพวกเราเถิด ท่านคือตำนานตัวจริง!' },
  { speaker: 'Player', text: 'ข้าขอรับคำอวยพรนี้ด้วยความยินดี ขอให้หมู่บ้านนี้มีความสุขตลอดไป!' }
];
