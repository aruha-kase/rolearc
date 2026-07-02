export type ActionType =
  | 'scene_switch'
  | 'board_effect'
  | 'bg_effect'
  | 'ambient_settings'
  | 'bgm_play' | 'bgm_stop'
  | 'se_play' | 'se_stop'
  | 'obj_visibility' | 'obj_position' | 'obj_scale' | 'obj_placement' | 'obj_layer' | 'obj_flip' | 'obj_expression'
  | 'obj_multi_placement'
  | 'video_play' | 'video_stop'
  | 'hide_all' | 'hide_characters'
  | 'screen_shake'
  | 'screen_flash'
  | 'text_overlay'
  | 'countdown'
  | 'obj_bounce'
  | 'grayscale'
  | 'text_copy'
  | 'discord_send'
  | 'delay'
  | 'multi';

export interface ObjectSnapshot {
  objectId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z_index: number;
  flip_x: boolean;
  rotation: number;
  crop_top: number;
  crop_right: number;
  crop_bottom: number;
  crop_left: number;
}

export interface ActionConfig {
  type: ActionType;
  // scene_switch
  sceneId?: string;
  // board_effect
  effect?: 'none' | 'sepia' | 'invert' | 'darken' | 'ambient';
  // bg_effect
  blur?: number;
  brightness?: number;
  saturation?: number;
  // ambient_settings
  ambientBrightness?: number;
  ambientSaturation?: number;
  ambientColor?: string;
  ambientBlendMode?: string; // multiply / overlay / screen / soft-light など
  ambientOpacity?: number;   // 0〜1
  // bgm / se
  trackId?: string;
  // obj_*
  objectId?: string;
  visible?: boolean;
  x?: number;
  y?: number;
  scale?: number; // obj_scale: target width in px (height adjusted proportionally)
  layerMode?: 'front' | 'back' | 'value';
  zIndex?: number;
  flipped?: boolean;
  variantIndex?: number;
  // hide_all / hide_characters
  hidden?: boolean;
  // text_copy / discord_send
  text?: string;
  // discord_send
  discordWebhookUrl?: string;
  // delay
  delayMs?: number;
  // bgm_play / bgm_stop / video_play / video_stop fade
  fadeMs?: number;
  // screen_shake
  shakeIntensity?: number; // 揺れの強さ (px)
  shakeDurationMs?: number; // 揺れの継続時間 (ms)
  shakeFrequency?: number; // 揺れの回数（サイクル数）
  shakePattern?: 'horizontal' | 'vertical' | 'combined'; // 揺れパターン
  // screen_flash
  flashColor?: string;      // フラッシュ色
  flashDurationMs?: number; // フェード時間
  flashOpacity?: number;    // 最大不透明度 0〜1
  // text_overlay
  overlayText?: string;
  overlayPosition?: 'top' | 'center' | 'bottom';
  overlayFontSize?: number; // px
  overlayColor?: string;
  overlayDurationMs?: number; // 表示時間（0以下で手動消去まで保持）
  // countdown
  countdownSeconds?: number;
  countdownPosition?: 'top' | 'center' | 'bottom';
  countdownLabel?: string;
  countdownFontSize?: number;   // 数字の大きさ(px)
  countdownAlertColor?: string; // 残り3秒以下の色
  // obj_bounce
  bounceLoop?: boolean;      // ループ（停止アクションまで継続）
  bounceCount?: number;      // ループOFF時の回数
  bounceIntensity?: number;  // 跳ねる高さ(px)
  bounceDurationMs?: number; // 1回あたりの時間
  bounceStop?: boolean;      // true でそのオブジェクトのバウンス停止
  // grayscale
  grayscaleEnabled?: boolean; // true=白黒ON / false=解除
  grayscaleMode?: 'select' | 'characters'; // 個別選択 / キャラ全員カラー
  grayscaleKeepIds?: string[]; // select時にカラーで残すオブジェクトID
  // multi
  actions?: ActionConfig[];
  // obj_multi_placement
  snapshots?: ObjectSnapshot[];
}

export const ACTION_LABELS: Record<ActionType, string> = {
  scene_switch: 'シーン切り替え',
  board_effect: '盤面エフェクト',
  bg_effect: '背景エフェクト',
  ambient_settings: 'アンビエント設定',
  bgm_play: 'BGM再生',
  bgm_stop: 'BGM停止',
  se_play: 'SE再生',
  se_stop: 'SE停止',
  obj_visibility: 'オブジェクト表示/非表示',
  obj_position: 'オブジェクト位置',
  obj_scale: 'オブジェクトスケール',
  obj_placement: 'オブジェクト配置',
  obj_multi_placement: '一括オブジェクト配置',
  obj_layer: 'オブジェクトレイヤー',
  obj_flip: 'オブジェクト反転',
  obj_expression: '表情切り替え',
  video_play: '動画再生',
  video_stop: '動画停止',
  hide_all: '全オブジェクト非表示',
  hide_characters: 'キャラクター非表示',
  screen_shake: '画面揺れ',
  screen_flash: 'フラッシュ',
  text_overlay: 'テキスト表示',
  countdown: 'カウントダウン',
  obj_bounce: 'バウンス',
  grayscale: '白黒エフェクト',
  text_copy: 'テキストコピー',
  discord_send: 'Discord送信',
  delay: 'ディレイ',
  multi: '複数アクション',
};
