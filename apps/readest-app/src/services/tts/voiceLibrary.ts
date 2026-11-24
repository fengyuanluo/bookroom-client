import type { AppService } from '@/types/system';
import type { CustomTTSService } from '@/types/customTTS';
import { EdgeSpeechProvider } from './providers/edge';
import {
  CUSTOM_TTS_PROVIDER_ID,
  OpenAICompatibleSpeechProvider,
} from './providers/openaiCompatible';
import { MULTILINGUAL_LANG, type TTSVoice, type TTSVoicesGroup } from './types';
import { groupProviderVoices as group } from './voiceGroups';
import { getNativeClient } from './voicePreview';
import { WebSpeechClient } from './WebSpeechClient';

// Every voice this device can read with, for choosing a language's default
// voice outside a reading session (Settings opened from the library). Groups
// come in the reading picker's order: custom services, Edge, then the system
// voices.

export interface VoiceLibrary {
  // Primary language codes with at least one voice, multilingual ones aside.
  languages: string[];
  getVoices(lang: string): Promise<TTSVoicesGroup[]>;
}

export const loadVoiceLibrary = async ({
  appService,
  customServices,
}: {
  appService: AppService | null;
  customServices: () => CustomTTSService[];
}): Promise<VoiceLibrary> => {
  const edge = new EdgeSpeechProvider();
  const custom = new OpenAICompatibleSpeechProvider(customServices);
  const web = new WebSpeechClient();
  const native =
    appService?.isAndroidApp || appService?.isIOSApp || appService?.isLinuxApp
      ? getNativeClient()
      : null;
  const [edgeVoices, customVoices] = await Promise.all([
    edge.getAllVoices(),
    custom.getAllVoices().catch(() => [] as TTSVoice[]),
    web.init(),
    native && !native.initialized ? native.init().catch(() => false) : null,
  ]);
  const systemVoices = [
    ...(await web.getAllVoices()),
    ...(native?.initialized ? await native.getAllVoices() : []),
  ];
  const languages = new Set(
    [...customVoices, ...edgeVoices, ...systemVoices]
      .map((voice) => voice.lang.split('-')[0]!.toLowerCase())
      .filter((lang) => lang && lang !== MULTILINGUAL_LANG),
  );
  return {
    languages: [...languages],
    getVoices: async (lang) =>
      [
        ...group(custom, CUSTOM_TTS_PROVIDER_ID, customVoices, lang, false),
        ...group(edge, edge.id, edgeVoices, lang, false),
        ...(native?.initialized ? await native.getVoices(lang) : []),
        ...(await web.getVoices(lang)),
      ].filter((voiceGroup) => voiceGroup.voices.length > 0),
  };
};
