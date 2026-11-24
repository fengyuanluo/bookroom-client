'use client';

import clsx from 'clsx';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAppRouter } from '@/hooks/useAppRouter';
import { useEnv } from '@/context/EnvContext';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { useThemeStore } from '@/store/themeStore';
import { useTranslation } from '@/hooks/useTranslation';
import { saveSysSettings } from '@/helpers/settings';
import { getBaseUrl } from '@/services/environment';
import { navigateBackFromProfile, navigateToLibrary } from '@/utils/nav';
import { Toast } from '@/components/Toast';
import ProfileHeader from './components/Header';
import UserInfo from './components/UserInfo';
import AccountActions from './components/AccountActions';
import { SyncPassphraseSection } from './components/SyncPassphraseSection';
import { SyncCategoriesSection } from './components/SyncCategoriesSection';

const ProfilePage = () => {
  const _ = useTranslation();
  const router = useAppRouter();
  const { envConfig, appService } = useEnv();
  const { token, user, logout } = useAuth();
  const { safeAreaInsets, isRoundedWindow } = useThemeStore();
  const searchParams = useSearchParams();
  const [showSyncManager, setShowSyncManager] = useState(
    () => searchParams?.get('section') === 'sync',
  );
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || (user && token && appService)) return;
    const timer = setTimeout(() => {
      const redirect = searchParams?.get('redirect') || '/library';
      router.push(`/auth?redirect=${encodeURIComponent(redirect)}`);
    }, 1000);
    return () => clearTimeout(timer);
  }, [mounted, user, token, appService, router, searchParams]);

  useTheme({ systemUIVisible: false });

  const handleGoBack = () => {
    if (showSyncManager) {
      setShowSyncManager(false);
    } else {
      navigateBackFromProfile(router, searchParams?.get('redirect'));
    }
  };

  const handleLogout = async () => {
    await logout();
    saveSysSettings(envConfig, 'keepLogin', false);
    navigateToLibrary(router);
  };

  if (!mounted) return null;

  if (!user || !token || !appService) {
    return (
      <div className='mx-auto max-w-4xl px-4 py-8'>
        <div className='flex min-h-[300px] items-center justify-center p-6'>
          <div className='text-base-content animate-pulse'>{_('Loading profile...')}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'bg-base-100 full-height inset-0 select-none overflow-hidden',
        appService.hasRoundedWindow && isRoundedWindow && 'window-border rounded-window',
      )}
    >
      <div
        className='flex h-full w-full flex-col items-center overflow-y-auto'
        style={{ paddingTop: `${safeAreaInsets?.top || 0}px` }}
      >
        <ProfileHeader onGoBack={handleGoBack} />
        <div className='w-full min-w-60 max-w-4xl py-10'>
          <div className='sm:bg-base-200 overflow-hidden rounded-lg sm:p-6 sm:shadow-md'>
            <div className='flex flex-col gap-y-8 px-6'>
              <UserInfo user={user} server={getBaseUrl()} />
              {showSyncManager ? (
                <>
                  <SyncCategoriesSection />
                  <SyncPassphraseSection />
                </>
              ) : (
                <AccountActions
                  onLogout={handleLogout}
                  onManageSync={() => setShowSyncManager(true)}
                />
              )}
            </div>
          </div>
        </div>
        <Toast />
      </div>
    </div>
  );
};

export default ProfilePage;
