-- アンビエントのブレンドモード・不透明度を永続化するための列追加
-- 既存行は DEFAULT で自動的に埋まるため、既存シーンの見た目は変わらない
-- （soft-light / 0.5 は従来のハードコード値と同じ）

-- デフォルトは現状の見た目（multiply / 0.25）に合わせ、既存シーンの印象を変えない
ALTER TABLE scenes
  ADD COLUMN IF NOT EXISTS ambient_blend_mode text DEFAULT 'multiply',
  ADD COLUMN IF NOT EXISTS ambient_opacity numeric DEFAULT 0.25;
