import { useCustomTranslatorStore } from '@/store/customTranslatorStore';
import { TranslationProvider } from '../types';
import { createCustomTranslator } from '../custom';
import { azureProvider } from './azure';
import { googleProvider } from './google';
import { yandexProvider } from './yandex';

function createTranslator<T extends string>(
  name: T,
  implementation: TranslationProvider,
): TranslationProvider & { name: T } {
  if (name !== implementation.name) {
    throw Error(
      `Translator name "${name}" does not match implementation name "${implementation.name}"`,
    );
  }
  return implementation as TranslationProvider & { name: T };
}

const azureTranslator = createTranslator('azure', azureProvider);
const googleTranslator = createTranslator('google', googleProvider);
const yandexTranslator = createTranslator('yandex', yandexProvider);

const availableTranslators = [
  azureTranslator,
  googleTranslator,
  yandexTranslator,
  // Add more translators here
];

/** A built-in name, or `custom:<id>` for a user-configured translator. */
export type TranslatorName = string;

/** Built-in translators followed by the user's custom ones. */
export const getTranslators = (): TranslationProvider[] => {
  const custom = useCustomTranslatorStore
    .getState()
    .getAvailableTranslators()
    .map(createCustomTranslator);
  return [...availableTranslators, ...custom];
};

export const getTranslator = (name: TranslatorName): TranslationProvider | undefined => {
  return getTranslators().find((translator) => translator.name === name);
};

/**
 * Single source of truth for "can this provider actually be used right now?".
 * Used by auto-selection / fallback logic in `useTranslator`, the settings
 * panel, and the translator popup. Disabled providers (temporarily down
 * upstream services, app-only providers on the web) are still returned from
 * `getTranslators()` so the UI can render them greyed out, but this predicate
 * excludes them so they can never be chosen or fallen back to.
 */
export const isTranslatorAvailable = (translator: TranslationProvider): boolean =>
  !translator.disabled;

/**
 * The user-facing dropdown label for a provider, with a short suffix when it
 * only works in the native apps. The `_` translation function is passed in so
 * this module stays free of React imports.
 */
export const getTranslatorDisplayLabel = (
  translator: TranslationProvider,
  _: (key: string) => string,
): string =>
  translator.disabled && translator.requiresApp
    ? `${translator.label} (${_('App only')})`
    : translator.label;
