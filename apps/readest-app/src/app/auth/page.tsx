'use client';
import clsx from 'clsx';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IoArrowBack } from 'react-icons/io5';

import { useAuth } from '@/context/AuthContext';
import { useEnv } from '@/context/EnvContext';
import { useTheme } from '@/hooks/useTheme';
import { useThemeStore } from '@/store/themeStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useEnsureSettingsLoaded } from '@/hooks/useEnsureSettingsLoaded';
import { useTranslation } from '@/hooks/useTranslation';
import { useTrafficLightStore } from '@/store/trafficLightStore';
import { getBaseUrl, isTauriAppPlatform } from '@/services/environment';
import { BookRoomAuthError, login } from '@/services/bookroom/session';
import { getHorizontalInsetStyle } from '@/utils/insets';
import WindowButtons from '@/components/WindowButtons';

const INPUT_CLASS = 'input eink-bordered w-full rounded-lg placeholder:text-sm';

export default function AuthPage() {
  const _ = useTranslation();
  const router = useRouter();
  const { login: adoptSession } = useAuth();
  const { envConfig, appService } = useEnv();
  const { safeAreaInsets, isRoundedWindow, isIPhoneDuo } = useThemeStore();
  const { isTrafficLightVisible } = useTrafficLightStore();
  const { settings, setSettings, saveSettings } = useSettingsStore();
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const headerRef = useRef<HTMLDivElement>(null);

  useTheme({ systemUIVisible: false });
  // A deep link can land here cold; hydrate before handleGoBack writes keepLogin.
  const settingsLoaded = useEnsureSettingsLoaded();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Read from the form's DOM state: mobile password managers fill WebView
    // inputs without events React state can track.
    const form = new FormData(event.currentTarget);
    const server = String(form.get('server') || '').trim();
    const username = String(form.get('username') || '').trim();
    const password = String(form.get('password') || '');
    setError('');
    setLoading(true);
    try {
      adoptSession(await login(server, username, password));
      router.push(new URLSearchParams(window.location.search).get('redirect') || '/library');
    } catch (cause) {
      if (cause instanceof BookRoomAuthError && cause.status === 401) {
        setError(_('Incorrect username or password'));
      } else if (cause instanceof BookRoomAuthError) {
        setError(cause.message);
      } else {
        setError(_('Cannot reach the server. Check the address and your connection.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    // Keep login false to avoid an endless redirect back to this page. On a
    // cold load the store is still empty, so read through to disk first.
    void (async () => {
      try {
        const service = await envConfig.getAppService();
        const current = settingsLoaded ? settings : await service.loadSettings();
        const next = { ...current, keepLogin: false };
        setSettings(next);
        await saveSettings(envConfig, next);
      } catch (cause) {
        console.error('Failed to clear keepLogin:', cause);
      }
    })();
    const redirectTo = new URLSearchParams(window.location.search).get('redirect');
    if (redirectTo) {
      router.push(redirectTo);
    } else {
      router.back();
    }
  };

  if (!isMounted) return null;

  const panel = (
    <div className='flex w-full max-w-sm flex-col items-center gap-6'>
      <div className='flex flex-col items-center gap-3 text-center'>
        <Image src='/icon.png' alt='' width={56} height={56} className='eink-bordered rounded-xl' />
        <div>
          <h1 className='text-xl font-semibold tracking-tight'>{_('Sign in to BookRoom')}</h1>
          <p className='text-base-content/70 mt-1.5 text-sm leading-relaxed'>
            {_('Your library, reading progress, and highlights on every device.')}
          </p>
        </div>
      </div>
      <form method='post' onSubmit={handleSubmit} className='w-full space-y-4'>
        <div className='flex flex-col'>
          <label className='select-none px-1 py-2 text-sm' htmlFor='server'>
            {_('Server')}
          </label>
          <input
            id='server'
            name='server'
            type='text'
            inputMode='url'
            required
            autoCapitalize='off'
            autoCorrect='off'
            spellCheck={false}
            defaultValue={getBaseUrl()}
            placeholder='https://books.example.com'
            className={INPUT_CLASS}
            disabled={loading}
          />
        </div>
        <div className='flex flex-col'>
          <label className='select-none px-1 py-2 text-sm' htmlFor='username'>
            {_('Username or email')}
          </label>
          <input
            id='username'
            name='username'
            type='text'
            required
            autoCapitalize='off'
            autoCorrect='off'
            autoComplete='username'
            className={INPUT_CLASS}
            disabled={loading}
          />
        </div>
        <div className='flex flex-col'>
          <label className='select-none px-1 py-2 text-sm' htmlFor='password'>
            {_('Password')}
          </label>
          <input
            id='password'
            name='password'
            type='password'
            required
            autoComplete='current-password'
            className={INPUT_CLASS}
            disabled={loading}
          />
        </div>
        <button type='submit' className='btn btn-primary w-full rounded-lg' disabled={loading}>
          {loading && <span className='loading loading-spinner loading-sm' aria-hidden='true' />}
          {loading ? _('Signing in...') : _('Sign in')}
        </button>
        {error && (
          <div
            role='alert'
            className='eink-bordered border-error/30 bg-error/5 text-error rounded-lg border px-3 py-2.5 text-center text-sm leading-relaxed'
          >
            {error}
          </div>
        )}
        <p className='text-base-content/60 text-center text-xs leading-relaxed'>
          {_('Accounts are created by the administrator of your BookRoom server.')}
        </p>
      </form>
    </div>
  );

  return isTauriAppPlatform() ? (
    <div
      className={clsx(
        'bg-base-100 full-height inset-0 flex select-none flex-col items-center overflow-hidden',
        appService?.hasRoundedWindow && isRoundedWindow && 'window-border rounded-window',
      )}
    >
      <div
        className='flex h-full w-full flex-col items-center overflow-y-auto'
        style={{
          paddingTop: `${safeAreaInsets?.top || 0}px`,
          ...getHorizontalInsetStyle(safeAreaInsets, isIPhoneDuo),
        }}
      >
        <div
          ref={headerRef}
          className={clsx(
            'fixed z-10 flex w-full items-center justify-between py-2 pe-6 ps-4',
            appService?.hasTrafficLight && 'pt-11',
          )}
          style={{
            top: `${safeAreaInsets?.top || 0}px`,
            // Fixed, so it does not inherit the wrapper's inset; keep the Back
            // button clear of iPhone Duo's side status strip (#6307).
            ...(isIPhoneDuo
              ? {
                  left: 0,
                  paddingLeft: `${(safeAreaInsets?.left || 0) + 16}px`,
                  paddingRight: `${(safeAreaInsets?.right || 0) + 24}px`,
                }
              : {}),
          }}
        >
          <button
            aria-label={_('Go Back')}
            onClick={handleGoBack}
            className='btn btn-ghost h-12 min-h-12 w-12 p-0 sm:h-8 sm:min-h-8 sm:w-8'
          >
            <IoArrowBack className='text-base-content' />
          </button>
          {appService?.hasWindowBar && (
            <WindowButtons
              headerRef={headerRef}
              showMinimize={!isTrafficLightVisible}
              showMaximize={!isTrafficLightVisible}
              showClose={!isTrafficLightVisible}
              onClose={handleGoBack}
            />
          )}
        </div>
        <div
          className={clsx(
            'z-20 flex w-full flex-col items-center px-6 pb-12',
            appService?.hasTrafficLight ? 'mt-24' : 'mt-16',
          )}
        >
          {panel}
        </div>
      </div>
    </div>
  ) : (
    <div className='bg-base-100 flex min-h-screen flex-col items-center overflow-y-auto px-6 pb-12 pt-20'>
      <button
        aria-label={_('Go Back')}
        onClick={handleGoBack}
        className='btn btn-ghost fixed start-6 top-6 h-8 min-h-8 w-8 p-0'
      >
        <IoArrowBack className='text-base-content' />
      </button>
      {panel}
    </div>
  );
}
