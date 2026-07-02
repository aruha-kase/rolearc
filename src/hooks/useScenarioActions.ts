import { useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ActionConfig } from '@/components/scenario/types';
import { SceneObject, CharacterVariant } from '@/types/trpg';
import { toast } from 'sonner';

export function useScenarioActions(
  roomId: string,
  objects: SceneObject[],
  currentSceneId: string | null,
  broadcast: (event: string, payload: Record<string, unknown>) => void,
  hideAllObjects: boolean = false,
  setHideAllObjects: (v: boolean) => void = () => {},
  hideCharacterObjects: boolean = false,
  setHideCharacterObjects: (v: boolean) => void = () => {},
  playBgm: (trackId: string, fadeMs?: number) => void = () => {},
  stopBgm: (fadeMs?: number) => void = () => {},
  playSe: (trackId: string) => void = () => {},
  stopSe: (trackId: string) => void = () => {},
) {

  const currentSceneIdRef = useRef(currentSceneId);
  useEffect(() => { currentSceneIdRef.current = currentSceneId; }, [currentSceneId]);

  const executeRef = useRef<(config: ActionConfig, activeSceneId?: string | null) => Promise<void>>(async () => {});

  const execute = useCallback(async (config: ActionConfig, activeSceneId?: string | null) => {
    const sceneId = activeSceneId !== undefined ? activeSceneId : currentSceneIdRef.current;

    switch (config.type) {

      case 'scene_switch': {
        if (!config.sceneId) return;
        broadcast('scene_change', { sceneId: config.sceneId });
        await supabase.from('rooms').update({ current_scene_id: config.sceneId }).eq('id', roomId);
        break;
      }

      case 'board_effect': {
        if (!sceneId || !config.effect) return;
        const changes: Record<string, unknown> = { scene_effect: config.effect };
        if (config.effect === 'ambient') {
          if (config.ambientBrightness != null) changes.ambient_brightness = config.ambientBrightness;
          if (config.ambientSaturation != null) changes.ambient_saturation = config.ambientSaturation;
          if (config.ambientColor) changes.ambient_color = config.ambientColor;
          if (config.ambientBlendMode) changes.ambient_blend_mode = config.ambientBlendMode;
          if (config.ambientOpacity != null) changes.ambient_opacity = config.ambientOpacity;
        }
        broadcast('scene_update', { sceneId, changes });
        const { error } = await supabase.from('scenes').update(changes).eq('id', sceneId);
        // 新列が未マイグレーションでも既存設定は保存できるようフォールバック
        if (error) {
          const { ambient_blend_mode, ambient_opacity, ...legacy } = changes;
          await supabase.from('scenes').update(legacy).eq('id', sceneId);
        }
        break;
      }

      case 'bg_effect': {
        if (!sceneId) return;
        const changes = {
          background_blur: config.blur ?? 0,
          background_brightness: config.brightness ?? 100,
          background_saturation: config.saturation ?? 100,
        };
        broadcast('scene_update', { sceneId, changes });
        await supabase.from('scenes').update(changes).eq('id', sceneId);
        break;
      }

      case 'ambient_settings': {
        if (!sceneId) return;
        const changes: Record<string, unknown> = {
          ambient_brightness: config.ambientBrightness ?? 100,
          ambient_saturation: config.ambientSaturation ?? 100,
          ambient_color: config.ambientColor ?? '#1b3a5c',
          ambient_blend_mode: config.ambientBlendMode ?? 'multiply',
          ambient_opacity: config.ambientOpacity ?? 0.25,
        };
        // 描画はbroadcastで即時反映（列が未追加でもUIには効く）
        broadcast('scene_update', { sceneId, changes });
        const { error } = await supabase.from('scenes').update(changes).eq('id', sceneId);
        // 新列(ambient_blend_mode/ambient_opacity)が未マイグレーションでも既存設定は保存できるようにフォールバック
        if (error) {
          const { ambient_blend_mode, ambient_opacity, ...legacy } = changes;
          await supabase.from('scenes').update(legacy).eq('id', sceneId);
        }
        break;
      }

      case 'obj_expression': {
        if (!config.objectId || config.variantIndex == null) return;
        // ローカルのobjectsはBoardPageのuseRoomと別インスタンスなので、DBから直接取得する
        const { data: freshObj } = await supabase
          .from('objects')
          .select('variants')
          .eq('id', config.objectId)
          .single();
        const freshVariants: CharacterVariant[] = Array.isArray(freshObj?.variants)
          ? (freshObj.variants as unknown as CharacterVariant[])
          : [];
        const targetVariant = freshVariants[config.variantIndex];
        const exUpdates: Record<string, unknown> = { current_variant_index: config.variantIndex };
        if (targetVariant && (
          targetVariant.crop_top !== undefined || targetVariant.crop_right !== undefined ||
          targetVariant.crop_bottom !== undefined || targetVariant.crop_left !== undefined
        )) {
          exUpdates.crop_top = targetVariant.crop_top ?? 0;
          exUpdates.crop_right = targetVariant.crop_right ?? 0;
          exUpdates.crop_bottom = targetVariant.crop_bottom ?? 0;
          exUpdates.crop_left = targetVariant.crop_left ?? 0;
        }
        await supabase.from('objects').update(exUpdates).eq('id', config.objectId);
        break;
      }

      case 'obj_multi_placement': {
        break;
      }

      case 'obj_placement': {
        if (!config.objectId) return;
        const target = objects.find(o => o.id === config.objectId);
        if (!target) { toast.error(`オブジェクト「${config.objectId}」が見つかりません`); return; }
        const updates: Record<string, unknown> = {};
        if (config.x != null) updates.x = config.x;
        if (config.y != null) updates.y = config.y;
        if (config.scale != null) {
          const factor = config.scale / (target.width ?? 300);
          updates.width = config.scale;
          updates.height = Math.round((target.height ?? 300) * factor);
          const cropT = target.crop_top ?? 0;
          const cropR = target.crop_right ?? 0;
          const cropB = target.crop_bottom ?? 0;
          const cropL = target.crop_left ?? 0;
          if (cropT || cropR || cropB || cropL) {
            updates.crop_top = Math.round(cropT * factor);
            updates.crop_right = Math.round(cropR * factor);
            updates.crop_bottom = Math.round(cropB * factor);
            updates.crop_left = Math.round(cropL * factor);
          }
        }
        if (config.layerMode === 'front') {
          updates.z_index = objects.reduce((max, o) => Math.max(max, o.z_index ?? 0), 0) + 1;
        } else if (config.layerMode === 'back') {
          updates.z_index = objects.reduce((min, o) => Math.min(min, o.z_index ?? 0), target.z_index ?? 0) - 1;
        } else if (config.layerMode === 'value' && config.zIndex != null) {
          updates.z_index = config.zIndex;
        }
        if (config.flipped != null) updates.flip_x = config.flipped;
        if (Object.keys(updates).length > 0) {
          await supabase.from('objects').update(updates).eq('id', config.objectId);
        }
        break;
      }

      case 'obj_layer': {
        if (!config.objectId || !config.layerMode) return;
        const target = objects.find(o => o.id === config.objectId);
        if (!target) { toast.error(`オブジェクト「${config.objectId}」が見つかりません`); return; }
        let newZ: number;
        if (config.layerMode === 'front') {
          newZ = objects.reduce((max, o) => Math.max(max, o.z_index ?? 0), 0) + 1;
        } else if (config.layerMode === 'back') {
          newZ = objects.reduce((min, o) => Math.min(min, o.z_index ?? 0), target.z_index ?? 0) - 1;
        } else {
          if (config.zIndex == null) return;
          newZ = config.zIndex;
        }
        await supabase.from('objects').update({ z_index: newZ }).eq('id', config.objectId);
        break;
      }

      case 'obj_visibility':
      case 'obj_position':
      case 'obj_scale':
      case 'obj_flip': {
        if (!config.objectId) return;
        const target = objects.find(o => o.id === config.objectId);
        if (!target) {
          toast.error(`オブジェクト「${config.objectId}」が見つかりません`);
          return;
        }
        const updates: Record<string, unknown> = {};
        if (config.type === 'obj_visibility' && config.visible != null) {
          updates.is_visible = config.visible;
        }
        if (config.type === 'obj_position') {
          if (config.x != null) updates.x = config.x;
          if (config.y != null) updates.y = config.y;
        }
        if (config.type === 'obj_scale' && config.scale != null) {
          const oldW = target.width ?? 300;
          const oldH = target.height ?? 300;
          const factor = config.scale / oldW;
          updates.width = config.scale;
          updates.height = Math.round(oldH * factor);
          const cropT = target.crop_top ?? 0;
          const cropR = target.crop_right ?? 0;
          const cropB = target.crop_bottom ?? 0;
          const cropL = target.crop_left ?? 0;
          if (cropT || cropR || cropB || cropL) {
            updates.crop_top = Math.round(cropT * factor);
            updates.crop_right = Math.round(cropR * factor);
            updates.crop_bottom = Math.round(cropB * factor);
            updates.crop_left = Math.round(cropL * factor);
          }
        }
        if (config.type === 'obj_flip' && config.flipped != null) {
          updates.extra_data = JSON.stringify({ flipped_x: config.flipped });
        }
        await supabase.from('objects').update(updates).eq('id', config.objectId);
        break;
      }

      case 'video_play':
      case 'video_stop': {
        if (!config.objectId) return;
        const target = objects.find(o => o.id === config.objectId);
        if (!target) {
          toast.error(`オブジェクト「${config.objectId}」が見つかりません`);
          return;
        }
        broadcast('video_control', {
          objId: config.objectId,
          action: config.type === 'video_play' ? 'play' : 'pause',
        });
        break;
      }

      case 'bgm_play': {
        if (!config.trackId) return;
        playBgm(config.trackId, config.fadeMs);
        break;
      }

      case 'bgm_stop': {
        stopBgm(config.fadeMs);
        break;
      }

      case 'se_play': {
        if (!config.trackId) return;
        playSe(config.trackId);
        break;
      }

      case 'se_stop': {
        if (!config.trackId) return;
        stopSe(config.trackId);
        break;
      }

      case 'hide_all': {
        const next = !hideAllObjects;
        setHideAllObjects(next);
        setHideCharacterObjects(false);
        broadcast('visibility_filter', { hideAll: next, hideCharacters: false });
        break;
      }

      case 'hide_characters': {
        const next = !hideCharacterObjects;
        setHideAllObjects(false);
        setHideCharacterObjects(next);
        broadcast('visibility_filter', { hideAll: false, hideCharacters: next });
        break;
      }

      case 'screen_shake': {
        broadcast('screen_shake', {
          intensity: config.shakeIntensity ?? 12,
          durationMs: config.shakeDurationMs ?? 600,
          frequency: config.shakeFrequency ?? 3,
          pattern: config.shakePattern ?? 'combined',
        });
        break;
      }

      case 'screen_flash': {
        broadcast('screen_flash', {
          color: config.flashColor ?? '#ffffff',
          durationMs: config.flashDurationMs ?? 400,
          opacity: config.flashOpacity ?? 0.8,
        });
        break;
      }

      case 'text_overlay': {
        if (!config.overlayText) return;
        broadcast('text_overlay', {
          text: config.overlayText,
          position: config.overlayPosition ?? 'center',
          fontSize: config.overlayFontSize ?? 64,
          color: config.overlayColor ?? '#ffffff',
          durationMs: config.overlayDurationMs ?? 4000,
        });
        break;
      }

      case 'countdown': {
        broadcast('countdown', {
          seconds: config.countdownSeconds ?? 10,
          position: config.countdownPosition ?? 'center',
          label: config.countdownLabel ?? '',
          fontSize: config.countdownFontSize ?? 200,
          alertColor: config.countdownAlertColor ?? '#ff4444',
        });
        break;
      }

      case 'obj_bounce': {
        if (!config.objectId) return;
        broadcast('obj_bounce', {
          objectId: config.objectId,
          stop: config.bounceStop ?? false,
          loop: config.bounceLoop ?? false,
          count: config.bounceCount ?? 3,
          intensity: config.bounceIntensity ?? 30,
          durationMs: config.bounceDurationMs ?? 600,
        });
        break;
      }

      case 'grayscale': {
        broadcast('grayscale', {
          enabled: config.grayscaleEnabled ?? true,
          mode: config.grayscaleMode ?? 'characters',
          keepIds: config.grayscaleKeepIds ?? [],
        });
        break;
      }

      case 'delay': {
        if (config.delayMs && config.delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, config.delayMs));
        }
        break;
      }

      case 'text_copy': {
        if (!config.text) return;
        await navigator.clipboard.writeText(config.text);
        toast.success('テキストをコピーしました');
        break;
      }

      case 'discord_send': {
        if (!config.discordWebhookUrl || !config.text) return;
        try {
          const res = await fetch(config.discordWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: config.text }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          toast.success('Discordに送信しました');
        } catch (err) {
          console.error('[discord_send]', err);
          toast.error('Discord送信に失敗しました');
        }
        break;
      }

      case 'multi': {
        let runningSceneId: string | null = sceneId;
        for (const action of config.actions ?? []) {
          await executeRef.current(action, runningSceneId);
          if (action.type === 'scene_switch' && action.sceneId) {
            runningSceneId = action.sceneId;
          }
        }
        break;
      }
    }
  }, [roomId, objects, broadcast, hideAllObjects, setHideAllObjects, hideCharacterObjects, setHideCharacterObjects, playBgm, stopBgm, playSe, stopSe]);

  executeRef.current = execute;

  return { execute };
}
