/* ── game25.js — 체스 (알파-베타 AI) ── */
'use strict';

/* ══ 상수 ══ */
const EMPTY=0, PAWN=1, KNIGHT=2, BISHOP=3, ROOK=4, QUEEN=5, KING=6;
const WHITE=1, BLACK=-1;
const SQ = 60; // 한 칸 픽셀

/* ══ 기물 유니코드 ══ */
const GLYPHS = {
  [WHITE*PAWN]:'♙',[WHITE*KNIGHT]:'♘',[WHITE*BISHOP]:'♗',
  [WHITE*ROOK]:'♖',[WHITE*QUEEN]:'♕',[WHITE*KING]:'♔',
  [BLACK*PAWN]:'♟',[BLACK*KNIGHT]:'♞',[BLACK*BISHOP]:'♝',
  [BLACK*ROOK]:'♜',[BLACK*QUEEN]:'♛',[BLACK*KING]:'♚',
};

/* ══ 기물 가치 ══ */
const VAL = [0, 100, 320, 330, 500, 900, 20000];

/* ══ 위치 테이블 (white 관점, black은 뒤집어 사용) ══ */
const PST = {
  [PAWN]: [
    [ 0,  0,  0,  0,  0,  0,  0,  0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [ 5,  5, 10, 25, 25, 10,  5,  5],
    [ 0,  0,  0, 20, 20,  0,  0,  0],
    [ 5, -5,-10,  0,  0,-10, -5,  5],
    [ 5, 10, 10,-20,-20, 10, 10,  5],
    [ 0,  0,  0,  0,  0,  0,  0,  0],
  ],
  [KNIGHT]: [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,  0,  0,  0,  0,-20,-40],
    [-30,  0, 10, 15, 15, 10,  0,-30],
    [-30,  5, 15, 20, 20, 15,  5,-30],
    [-30,  0, 15, 20, 20, 15,  0,-30],
    [-30,  5, 10, 15, 15, 10,  5,-30],
    [-40,-20,  0,  5,  5,  0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50],
  ],
  [BISHOP]: [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5, 10, 10,  5,  0,-10],
    [-10,  5,  5, 10, 10,  5,  5,-10],
    [-10,  0, 10, 10, 10, 10,  0,-10],
    [-10, 10, 10, 10, 10, 10, 10,-10],
    [-10,  5,  0,  0,  0,  0,  5,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20],
  ],
  [ROOK]: [
    [ 0,  0,  0,  0,  0,  0,  0,  0],
    [ 5, 10, 10, 10, 10, 10, 10,  5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [ 0,  0,  0,  5,  5,  0,  0,  0],
  ],
  [QUEEN]: [
    [-20,-10,-10, -5, -5,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5,  5,  5,  5,  0,-10],
    [ -5,  0,  5,  5,  5,  5,  0, -5],
    [  0,  0,  5,  5,  5,  5,  0, -5],
    [-10,  5,  5,  5,  5,  5,  0,-10],
    [-10,  0,  5,  0,  0,  0,  0,-10],
    [-20,-10,-10, -5, -5,-10,-10,-20],
  ],
  [KING]: [
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-20,-30,-30,-40,-40,-30,-30,-20],
    [-10,-20,-20,-20,-20,-20,-20,-10],
    [ 20, 20,  0,  0,  0,  0, 20, 20],
    [ 20, 30, 10,  0,  0, 10, 30, 20],
  ],
};

/* ══════════════════════════
   보드 상태
══════════════════════════ */
class ChessState {
  constructor() {
    this.board = this._initBoard();
    this.turn = WHITE;
    this.castleRights = { WK:true, WQ:true, BK:true, BQ:true };
    this.enPassant = null;   // {r,c} 앙파상 가능 칸
    this.halfMove = 0;
    this.fullMove = 1;
    this.history = [];       // [{board,turn,castleRights,enPassant,halfMove,fullMove}]
    this.moveLog  = [];      // 기보 [{white,black}]
  }

  _initBoard() {
    const b = Array.from({length:8}, ()=>Array(8).fill(0));
    const back = [ROOK,KNIGHT,BISHOP,QUEEN,KING,BISHOP,KNIGHT,ROOK];
    for(let c=0;c<8;c++){
      b[0][c] = -back[c];
      b[1][c] = -PAWN;
      b[6][c] =  PAWN;
      b[7][c] =  back[c];
    }
    return b;
  }

  clone() {
    const s = new ChessState();
    s.board = this.board.map(r=>[...r]);
    s.turn  = this.turn;
    s.castleRights = {...this.castleRights};
    s.enPassant = this.enPassant ? {...this.enPassant} : null;
    s.halfMove  = this.halfMove;
    s.fullMove  = this.fullMove;
    s.history   = [];
    s.moveLog   = [];
    return s;
  }

  snapshot() {
    return {
      board: this.board.map(r=>[...r]),
      turn:  this.turn,
      castleRights: {...this.castleRights},
      enPassant: this.enPassant ? {...this.enPassant} : null,
      halfMove: this.halfMove,
      fullMove: this.fullMove,
    };
  }
}

/* ══════════════════════════
   수 생성
══════════════════════════ */
function inBounds(r,c){ return r>=0&&r<8&&c>=0&&c<8; }

function pseudoMoves(state, turn) {
  const moves = [];
  const b = state.board;

  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    const pc = b[r][c];
    if(!pc || Math.sign(pc)!==turn) continue;
    const type = Math.abs(pc);

    if(type===PAWN){
      const dir = -turn; // white goes up (row--)
      const startRow = turn===WHITE ? 6 : 1;
      // 전진
      if(inBounds(r+dir,c) && b[r+dir][c]===0){
        if((turn===WHITE&&r+dir===0)||(turn===BLACK&&r+dir===7)){
          for(const p of [QUEEN,ROOK,BISHOP,KNIGHT])
            moves.push({fr:r,fc:c,tr:r+dir,tc:c,promo:p*turn});
        } else {
          moves.push({fr:r,fc:c,tr:r+dir,tc:c});
          if(r===startRow && b[r+2*dir][c]===0)
            moves.push({fr:r,fc:c,tr:r+2*dir,tc:c,dbl:true});
        }
      }
      // 대각 먹기
      for(const dc of[-1,1]){
        if(!inBounds(r+dir,c+dc)) continue;
        const target = b[r+dir][c+dc];
        // 앙파상
        if(state.enPassant && state.enPassant.r===r+dir && state.enPassant.c===c+dc)
          moves.push({fr:r,fc:c,tr:r+dir,tc:c+dc,ep:true});
        else if(target && Math.sign(target)===-turn){
          if((turn===WHITE&&r+dir===0)||(turn===BLACK&&r+dir===7)){
            for(const p of [QUEEN,ROOK,BISHOP,KNIGHT])
              moves.push({fr:r,fc:c,tr:r+dir,tc:c+dc,promo:p*turn});
          } else {
            moves.push({fr:r,fc:c,tr:r+dir,tc:c+dc});
          }
        }
      }
    }

    else if(type===KNIGHT){
      for(const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]){
        const nr=r+dr,nc=c+dc;
        if(inBounds(nr,nc) && Math.sign(b[nr][nc])!==turn)
          moves.push({fr:r,fc:c,tr:nr,tc:nc});
      }
    }

    else if(type===BISHOP||type===QUEEN){
      for(const [dr,dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]){
        let nr=r+dr,nc=c+dc;
        while(inBounds(nr,nc)){
          if(b[nr][nc]===0) moves.push({fr:r,fc:c,tr:nr,tc:nc});
          else { if(Math.sign(b[nr][nc])!==turn) moves.push({fr:r,fc:c,tr:nr,tc:nc}); break; }
          nr+=dr; nc+=dc;
        }
      }
    }

    if(type===ROOK||type===QUEEN){
      for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){
        let nr=r+dr,nc=c+dc;
        while(inBounds(nr,nc)){
          if(b[nr][nc]===0) moves.push({fr:r,fc:c,tr:nr,tc:nc});
          else { if(Math.sign(b[nr][nc])!==turn) moves.push({fr:r,fc:c,tr:nr,tc:nc}); break; }
          nr+=dr; nc+=dc;
        }
      }
    }

    else if(type===KING){
      for(const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]){
        const nr=r+dr,nc=c+dc;
        if(inBounds(nr,nc) && Math.sign(b[nr][nc])!==turn)
          moves.push({fr:r,fc:c,tr:nr,tc:nc});
      }
      // 캐슬링
      const kr = turn===WHITE ? 7 : 0;
      if(r===kr && c===4){
        if(turn===WHITE){
          if(state.castleRights.WK && b[7][5]===0 && b[7][6]===0 && !isAttacked(state,7,4,BLACK) && !isAttacked(state,7,5,BLACK))
            moves.push({fr:7,fc:4,tr:7,tc:6,castle:'WK'});
          if(state.castleRights.WQ && b[7][3]===0 && b[7][2]===0 && b[7][1]===0 && !isAttacked(state,7,4,BLACK) && !isAttacked(state,7,3,BLACK))
            moves.push({fr:7,fc:4,tr:7,tc:2,castle:'WQ'});
        } else {
          if(state.castleRights.BK && b[0][5]===0 && b[0][6]===0 && !isAttacked(state,0,4,WHITE) && !isAttacked(state,0,5,WHITE))
            moves.push({fr:0,fc:4,tr:0,tc:6,castle:'BK'});
          if(state.castleRights.BQ && b[0][3]===0 && b[0][2]===0 && b[0][1]===0 && !isAttacked(state,0,4,WHITE) && !isAttacked(state,0,3,WHITE))
            moves.push({fr:0,fc:4,tr:0,tc:2,castle:'BQ'});
        }
      }
    }
  }
  return moves;
}

function isAttacked(state, r, c, byColor) {
  const b = state.board;
  // 나이트
  for(const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]){
    const nr=r+dr,nc=c+dc;
    if(inBounds(nr,nc) && b[nr][nc]===byColor*KNIGHT) return true;
  }
  // 대각 (비숍/퀸/폰)
  for(const [dr,dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]){
    let nr=r+dr,nc=c+dc,dist=1;
    while(inBounds(nr,nc)){
      const pc=b[nr][nc];
      if(pc!==0){
        if(Math.sign(pc)===byColor){
          const t=Math.abs(pc);
          if(t===BISHOP||t===QUEEN) return true;
          if(dist===1&&t===KING) return true;
          if(dist===1&&t===PAWN&&((byColor===WHITE&&dr===1)||(byColor===BLACK&&dr===-1))) return true;
        }
        break;
      }
      nr+=dr; nc+=dc; dist++;
    }
  }
  // 직선 (룩/퀸)
  for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){
    let nr=r+dr,nc=c+dc,dist=1;
    while(inBounds(nr,nc)){
      const pc=b[nr][nc];
      if(pc!==0){
        if(Math.sign(pc)===byColor){
          const t=Math.abs(pc);
          if(t===ROOK||t===QUEEN) return true;
          if(dist===1&&t===KING) return true;
        }
        break;
      }
      nr+=dr; nc+=dc; dist++;
    }
  }
  return false;
}

function applyMove(state, mv) {
  const b = state.board;
  const pc = b[mv.fr][mv.fc];
  const captured = b[mv.tr][mv.tc];

  b[mv.tr][mv.tc] = mv.promo ? mv.promo : pc;
  b[mv.fr][mv.fc] = 0;

  // 앙파상 먹기
  if(mv.ep){
    b[mv.fr][mv.tc] = 0;
  }
  // 앙파상 기회 설정
  state.enPassant = mv.dbl
    ? { r:(mv.fr+mv.tr)/2, c:mv.fc }
    : null;

  // 캐슬링 룩 이동
  if(mv.castle){
    if(mv.castle==='WK'){ b[7][7]=0; b[7][5]=ROOK; }
    if(mv.castle==='WQ'){ b[7][0]=0; b[7][3]=ROOK; }
    if(mv.castle==='BK'){ b[0][7]=0; b[0][5]=-ROOK; }
    if(mv.castle==='BQ'){ b[0][0]=0; b[0][3]=-ROOK; }
  }

  // 캐슬링 권리 업데이트
  const t=Math.abs(pc);
  if(t===KING){ if(state.turn===WHITE){state.castleRights.WK=false;state.castleRights.WQ=false;}else{state.castleRights.BK=false;state.castleRights.BQ=false;} }
  if(t===ROOK){ if(mv.fr===7&&mv.fc===7)state.castleRights.WK=false; if(mv.fr===7&&mv.fc===0)state.castleRights.WQ=false; if(mv.fr===0&&mv.fc===7)state.castleRights.BK=false; if(mv.fr===0&&mv.fc===0)state.castleRights.BQ=false; }

  state.halfMove = (t===PAWN||captured!==0) ? 0 : state.halfMove+1;
  if(state.turn===BLACK) state.fullMove++;
  state.turn = -state.turn;

  return captured;
}

function legalMoves(state) {
  const pseudo = pseudoMoves(state, state.turn);
  return pseudo.filter(mv => {
    const clone = state.clone();
    applyMove(clone, mv);
    return !kingInCheck(clone, state.turn);
  });
}

function kingInCheck(state, color) {
  const b = state.board;
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    if(b[r][c]===color*KING) return isAttacked(state,r,c,-color);
  }
  return false;
}

/* ══════════════════════════
   AI — 알파베타
══════════════════════════ */
function evaluate(state) {
  let score = 0;
  const b = state.board;
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    const pc = b[r][c];
    if(!pc) continue;
    const side  = Math.sign(pc);
    const type  = Math.abs(pc);
    const pstR  = side===WHITE ? r : 7-r;
    const mat   = VAL[type];
    const pos   = PST[type] ? PST[type][pstR][c] : 0;
    score += side * (mat + pos);
  }
  return score;
}

function orderMoves(state, moves) {
  return moves.sort((a,b)=>{
    const capA = Math.abs(state.board[a.tr][a.tc]);
    const capB = Math.abs(state.board[b.tr][b.tc]);
    return (capB?VAL[capB]:0) - (capA?VAL[capA]:0);
  });
}

function alphaBeta(state, depth, alpha, beta, maximizing) {
  if(depth===0) return evaluate(state);
  const moves = legalMoves(state);
  if(moves.length===0){
    if(kingInCheck(state, state.turn)) return maximizing ? -99999 : 99999;
    return 0; // 스테일메이트
  }
  orderMoves(state, moves);
  if(maximizing){
    let best=-Infinity;
    for(const mv of moves){
      const clone=state.clone(); applyMove(clone,mv);
      const v=alphaBeta(clone,depth-1,alpha,beta,false);
      best=Math.max(best,v); alpha=Math.max(alpha,v);
      if(beta<=alpha) break;
    }
    return best;
  } else {
    let best=Infinity;
    for(const mv of moves){
      const clone=state.clone(); applyMove(clone,mv);
      const v=alphaBeta(clone,depth-1,alpha,beta,true);
      best=Math.min(best,v); beta=Math.min(beta,v);
      if(beta<=alpha) break;
    }
    return best;
  }
}

function bestAIMove(state, depth) {
  const moves = legalMoves(state);
  if(!moves.length) return null;
  let bestScore=Infinity, bestMv=null;
  orderMoves(state, moves);
  for(const mv of moves){
    const clone=state.clone(); applyMove(clone,mv);
    const v=alphaBeta(clone,depth-1,-Infinity,Infinity,true);
    if(v<bestScore){ bestScore=v; bestMv=mv; }
  }
  return bestMv;
}

/* ══════════════════════════
   기보 표기 (간략 대수기보)
══════════════════════════ */
const FILE_NAMES = ['a','b','c','d','e','f','g','h'];
const PIECE_NAMES = {[PAWN]:'',[KNIGHT]:'N',[BISHOP]:'B',[ROOK]:'R',[QUEEN]:'Q',[KING]:'K'};
function toAlgebraic(mv, type) {
  const p = PIECE_NAMES[Math.abs(type)] || '';
  const cap = mv.capture ? 'x' : '';
  const from = mv.ep ? FILE_NAMES[mv.fc] : '';
  const to = FILE_NAMES[mv.tc] + (8 - mv.tr);
  const promo = mv.promo ? '='+PIECE_NAMES[Math.abs(mv.promo)] : '';
  if(mv.castle==='WK'||mv.castle==='BK') return 'O-O';
  if(mv.castle==='WQ'||mv.castle==='BQ') return 'O-O-O';
  const capFile = (p===''&&cap) ? FILE_NAMES[mv.fc] : '';
  return p + capFile + cap + to + promo;
}

/* ══════════════════════════
   UI / 렌더링
══════════════════════════ */
const canvas    = document.getElementById('chessCanvas');
const ctx       = canvas.getContext('2d');
const overlay   = document.getElementById('chessOverlay');
const overlayBtn= document.getElementById('overlayBtn');
const overlayTitle = document.getElementById('overlayTitle');
const overlayMsg   = document.getElementById('overlayMsg');
const statusBox = document.getElementById('statusBox');
const statusText= document.getElementById('statusText');
const histList  = document.getElementById('historyList');
const whiteCap  = document.getElementById('whiteCaptured');
const blackCap  = document.getElementById('blackCaptured');
const startBtn  = document.getElementById('startBtn');
const undoBtn   = document.getElementById('undoBtn');
const promoPopup= document.getElementById('promotionPopup');
const whitePanel= document.getElementById('whitePanel');
const blackPanel= document.getElementById('blackPanel');

/* 좌표 라벨 */
const ranksEl = document.getElementById('boardRanks');
const filesEl = document.getElementById('boardFiles');
for(let i=8;i>=1;i--){ const s=document.createElement('span'); s.textContent=i; ranksEl.appendChild(s); }
for(const f of 'abcdefgh'){ const s=document.createElement('span'); s.textContent=f; filesEl.appendChild(s); }

/* ── 색상 팔레트 ── */
const LIGHT_SQ  = '#d4c9a8';
const DARK_SQ   = '#7c5c3a';
const HIGHLIGHT = 'rgba(255,214,0,0.42)';
const LAST_MOVE = 'rgba(124,193,52,0.38)';
const LEGAL_DOT = 'rgba(0,0,0,0.22)';
const LEGAL_CAP = 'rgba(255,80,80,0.35)';
const CHECK_CLR = 'rgba(220,40,40,0.50)';

/* ── 게임 상태 ── */
let state = null;
let selected = null;   // {r,c}
let legal   = [];      // 현재 선택된 기물의 합법 수
let allLegal= [];      // 현재 turn의 전체 합법 수
let lastMove= null;    // {fr,fc,tr,tc}
let gameActive = false;
let aiDepth = 3;
let aiThinking = false;
let pendingPromo = null;  // {mv, ...} 프로모션 대기
let whiteCaptured = [], blackCaptured = [];
let savedSnap = null;   // 무르기용

function startGame() {
  state = new ChessState();
  selected = null; legal = [];
  lastMove = null;
  gameActive = true;
  aiThinking  = false;
  pendingPromo= null;
  whiteCaptured = []; blackCaptured = [];
  whiteCap.textContent = '';
  blackCap.textContent = '';
  histList.innerHTML = '';
  overlay.classList.add('hidden');
  promoPopup.classList.add('hidden');
  undoBtn.disabled = false;
  allLegal = legalMoves(state);
  updateStatus();
  render();
}

/* ── 렌더 ── */
function render() {
  ctx.clearRect(0,0,480,480);
  drawBoard();
  drawHighlights();
  drawPieces();
}

function drawBoard() {
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    ctx.fillStyle = (r+c)%2===0 ? LIGHT_SQ : DARK_SQ;
    ctx.fillRect(c*SQ, r*SQ, SQ, SQ);
  }
}

function drawHighlights() {
  // 마지막 이동
  if(lastMove){
    ctx.fillStyle = LAST_MOVE;
    ctx.fillRect(lastMove.fc*SQ,lastMove.fr*SQ,SQ,SQ);
    ctx.fillRect(lastMove.tc*SQ,lastMove.tr*SQ,SQ,SQ);
  }
  // 선택된 칸
  if(selected){
    ctx.fillStyle = HIGHLIGHT;
    ctx.fillRect(selected.c*SQ,selected.r*SQ,SQ,SQ);
  }
  // 체크 표시
  if(gameActive && kingInCheck(state, state.turn)){
    const b=state.board;
    for(let r=0;r<8;r++) for(let c=0;c<8;c++){
      if(b[r][c]===state.turn*KING){
        const grd=ctx.createRadialGradient(c*SQ+SQ/2,r*SQ+SQ/2,0,c*SQ+SQ/2,r*SQ+SQ/2,SQ/2);
        grd.addColorStop(0,CHECK_CLR); grd.addColorStop(1,'transparent');
        ctx.fillStyle=grd; ctx.fillRect(c*SQ,r*SQ,SQ,SQ);
      }
    }
  }
  // 합법 수 표시
  for(const mv of legal){
    if(state.board[mv.tr][mv.tc]!==0 || mv.ep){
      ctx.fillStyle=LEGAL_CAP;
      ctx.beginPath(); ctx.arc(mv.tc*SQ+SQ/2,mv.tr*SQ+SQ/2,SQ/2,0,Math.PI*2); ctx.fill();
    } else {
      ctx.fillStyle=LEGAL_DOT;
      ctx.beginPath(); ctx.arc(mv.tc*SQ+SQ/2,mv.tr*SQ+SQ/2,SQ*0.16,0,Math.PI*2); ctx.fill();
    }
  }
}

function drawPieces() {
  const b = state ? state.board : new ChessState().board;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    const pc=b[r][c]; if(!pc) continue;
    const isWhite = pc>0;
    const x=c*SQ+SQ/2, y=r*SQ+SQ/2;

    // 그림자
    ctx.shadowColor = isWhite ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.6)';
    ctx.shadowBlur  = 4; ctx.shadowOffsetX=1; ctx.shadowOffsetY=2;

    ctx.font = `${SQ*0.72}px serif`;
    // 아웃라인
    ctx.strokeStyle = isWhite ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.15)';
    ctx.lineWidth=1.5;
    ctx.strokeText(GLYPHS[pc], x, y+1);
    ctx.fillStyle = isWhite ? '#f8f0d8' : '#1a1a2e';
    ctx.fillText(GLYPHS[pc], x, y+1);
    ctx.shadowBlur=0; ctx.shadowOffsetX=0; ctx.shadowOffsetY=0;
  }
}

/* ── 클릭 핸들러 ── */
canvas.addEventListener('click', e => {
  if(!gameActive || aiThinking || pendingPromo) return;
  if(state.turn !== WHITE) return; // 플레이어는 백

  const rect = canvas.getBoundingClientRect();
  const scaleX = 480 / rect.width;
  const scaleY = 480 / rect.height;
  const c = Math.floor((e.clientX - rect.left) * scaleX / SQ);
  const r = Math.floor((e.clientY - rect.top)  * scaleY / SQ);
  if(!inBounds(r,c)) return;

  // 합법 수로 이동
  if(selected){
    const mv = legal.find(m=>m.tr===r&&m.tc===c);
    if(mv){
      if(mv.promo!==undefined && !mv.promo){
        // 프로모션 선택 팝업
        pendingPromo = mv;
        promoPopup.classList.remove('hidden');
        return;
      }
      doMove(mv);
      return;
    }
  }

  // 기물 선택
  const pc = state.board[r][c];
  if(pc && Math.sign(pc)===WHITE){
    selected = {r,c};
    legal = allLegal.filter(m=>m.fr===r&&m.fc===c);
  } else {
    selected=null; legal=[];
  }
  render();
});

/* ── 프로모션 선택 ── */
promoPopup.querySelectorAll('.promo-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    if(!pendingPromo) return;
    const piece = parseInt(btn.dataset.piece) * WHITE;
    const mv = {...pendingPromo, promo:piece};
    pendingPromo = null;
    promoPopup.classList.add('hidden');
    doMove(mv);
  });
});

/* ── 수 실행 ── */
function doMove(mv) {
  savedSnap = state.snapshot();
  const pieceType = Math.abs(state.board[mv.fr][mv.fc]);
  mv.capture = state.board[mv.tr][mv.tc] !== 0 || mv.ep;
  const cap = applyMove(state, mv);
  if(cap) {
    if(state.turn===WHITE) blackCaptured.push(cap); // BLACK이 방금 먹힘
    else whiteCaptured.push(cap);
    updateCaptured();
  }
  lastMove = mv;
  selected=null; legal=[];
  logMove(mv, pieceType, state.turn); // turn이 이미 바뀐 후
  allLegal = legalMoves(state);
  updateStatus();
  render();

  if(!gameActive) return;
  // AI 차례
  if(state.turn===BLACK){
    requestAI();
  }
}

/* ── AI 실행 ── */
function requestAI() {
  aiThinking = true;
  setStatus('<span class="thinking-dot">●</span><span class="thinking-dot">●</span><span class="thinking-dot">●</span> 생각 중', '');
  setTimeout(()=>{
    const mv = bestAIMove(state, aiDepth);
    if(!mv){ endGame(); return; }
    const pieceType = Math.abs(state.board[mv.fr][mv.fc]);
    mv.capture = state.board[mv.tr][mv.tc]!==0||mv.ep;
    const cap = applyMove(state, mv);
    if(cap){ whiteCaptured.push(cap); updateCaptured(); }
    lastMove = mv;
    selected=null; legal=[];
    logMove(mv, pieceType, state.turn);
    allLegal = legalMoves(state);
    aiThinking = false;
    updateStatus();
    render();
    if(!gameActive) return;
    allLegal = legalMoves(state);
    if(allLegal.length===0) endGame();
  }, 50);
}

/* ── 기보 ── */
function logMove(mv, type, nextTurn) {
  const notation = toAlgebraic(mv, type*nextTurn) + (kingInCheck(state,nextTurn)?'+':'');
  if(nextTurn===BLACK){ // 방금 백이 뒀음
    state.moveLog.push({white:notation, black:''});
  } else {
    if(state.moveLog.length) state.moveLog[state.moveLog.length-1].black=notation;
    else state.moveLog.push({white:'',black:notation});
  }
  renderHistory();
}

function renderHistory(){
  histList.innerHTML='';
  state.moveLog.forEach((row,i)=>{
    const div=document.createElement('div');
    div.className='hist-row';
    div.innerHTML=`<span class="hist-num">${i+1}.</span><span class="hist-w">${row.white}</span><span class="hist-b">${row.black}</span>`;
    histList.appendChild(div);
  });
  histList.scrollTop=histList.scrollHeight;
}

/* ── 잡은 기물 표시 ── */
function updateCaptured(){
  whiteCap.textContent = whiteCaptured.map(p=>GLYPHS[p]).join('');
  blackCap.textContent = blackCaptured.map(p=>GLYPHS[-p]).join('');
}

/* ── 상태 업데이트 ── */
function setStatus(text, cls=''){
  statusBox.className='cs-status'+(cls?' '+cls:'');
  statusText.innerHTML=text;
}

function updateStatus(){
  const inCheck = kingInCheck(state, state.turn);
  const noMoves = allLegal.length===0;
  if(noMoves){
    endGame(inCheck); return;
  }
  if(state.halfMove>=100){
    endGame(false,true); return;
  }
  if(inCheck){
    setStatus(state.turn===WHITE?'⚠️ 백 체크!':'⚠️ 흑 체크!','check');
  } else {
    setStatus(state.turn===WHITE?'⬜ 플레이어 차례':'⬛ AI 차례','');
  }
  // 차례 하이라이트
  whitePanel.style.opacity = state.turn===WHITE?'1':'0.5';
  blackPanel.style.opacity = state.turn===BLACK?'1':'0.5';
}

function endGame(isCheckmate=false, isDraw=false){
  gameActive=false;
  undoBtn.disabled=true;
  if(isDraw){
    overlayTitle.textContent='무승부';
    overlayMsg.textContent='50수 규칙에 의한 무승부';
    overlayIcon.textContent='🤝';
  } else if(!isCheckmate){
    overlayTitle.textContent='스테일메이트';
    overlayMsg.textContent='무승부 (스테일메이트)';
    overlayIcon.textContent='🤝';
    setStatus('스테일메이트 — 무승부','draw');
  } else if(state.turn===WHITE){
    overlayTitle.textContent='패배';
    overlayMsg.textContent='컴퓨터가 이겼습니다!\n포기하지 마세요 💪';
    overlayIcon.textContent='♚';
    setStatus('체크메이트 — AI 승!','check');
  } else {
    overlayTitle.textContent='승리! 🎉';
    overlayMsg.textContent='플레이어가 이겼습니다!\n훌륭한 플레이!';
    overlayIcon.textContent='♔';
    setStatus('체크메이트 — 플레이어 승!','win');
  }
  overlayBtn.textContent='다시 하기';
  overlay.classList.remove('hidden');
}

/* ── 무르기 ── */
undoBtn.addEventListener('click', ()=>{
  if(!savedSnap||!gameActive||aiThinking) return;
  state.board = savedSnap.board;
  state.turn  = savedSnap.turn;
  state.castleRights = savedSnap.castleRights;
  state.enPassant    = savedSnap.enPassant;
  state.halfMove     = savedSnap.halfMove;
  state.fullMove     = savedSnap.fullMove;
  if(state.moveLog.length){
    const last=state.moveLog[state.moveLog.length-1];
    if(last.black){ last.black=''; } else { state.moveLog.pop(); }
    if(state.moveLog.length){
      const prev=state.moveLog[state.moveLog.length-1];
      if(prev.black){ prev.black=''; } else { state.moveLog.pop(); }
    }
  }
  savedSnap=null;
  selected=null; legal=[]; lastMove=null;
  whiteCaptured=[]; blackCaptured=[]; updateCaptured();
  allLegal = legalMoves(state);
  renderHistory(); updateStatus(); render();
  undoBtn.disabled=true;
});

/* ── 난이도 버튼 ── */
document.querySelectorAll('.diff-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.diff-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    aiDepth = parseInt(btn.dataset.d);
  });
});

/* ── 시작/재시작 ── */
startBtn.addEventListener('click', startGame);
overlayBtn.addEventListener('click', startGame);

/* 초기 렌더 */
state = new ChessState();
render();
