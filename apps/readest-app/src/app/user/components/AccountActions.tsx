import { useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { BookRoomAuthError, changePassword } from '@/services/bookroom/session';
import { eventDispatcher } from '@/utils/event';

const BUTTON_CLASS =
  'bg-base-300 hover:bg-base-content/15 text-base-content border-base-content/10 eink-bordered w-full rounded-lg border px-6 py-3 font-medium transition-colors duration-150 md:w-auto';
const INPUT_CLASS = 'input eink-bordered w-full rounded-lg placeholder:text-sm';

interface AccountActionsProps {
  onLogout: () => void;
  onManageSync: () => void;
}

const AccountActions: React.FC<AccountActionsProps> = ({ onLogout, onManageSync }) => {
  const _ = useTranslation();
  const [changingPassword, setChangingPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChangePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get('currentPassword') || '');
    const newPassword = String(form.get('newPassword') || '');
    if (newPassword !== String(form.get('confirmPassword') || '')) {
      setError(_('The new passwords do not match'));
      return;
    }
    setError('');
    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setChangingPassword(false);
      eventDispatcher.dispatch('toast', { type: 'success', message: _('Password changed') });
    } catch (cause) {
      setError(
        cause instanceof BookRoomAuthError && cause.status === 401
          ? _('The current password is incorrect')
          : cause instanceof Error
            ? cause.message
            : _('Failed to change the password'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className='flex flex-col gap-4 md:grid md:grid-cols-2 lg:grid-cols-3'>
        <button onClick={onManageSync} className={BUTTON_CLASS}>
          {_('Manage Sync')}
        </button>
        <button onClick={() => setChangingPassword((open) => !open)} className={BUTTON_CLASS}>
          {_('Change Password')}
        </button>
        <button onClick={onLogout} className={BUTTON_CLASS}>
          {_('Sign Out')}
        </button>
      </div>
      {changingPassword && (
        <form
          onSubmit={handleChangePassword}
          className='eink-bordered border-base-300 flex max-w-md flex-col gap-3 rounded-lg border p-4'
        >
          <input
            name='currentPassword'
            type='password'
            required
            autoComplete='current-password'
            placeholder={_('Current password')}
            className={INPUT_CLASS}
            disabled={saving}
          />
          <input
            name='newPassword'
            type='password'
            required
            minLength={8}
            autoComplete='new-password'
            placeholder={_('New password (at least 8 characters)')}
            className={INPUT_CLASS}
            disabled={saving}
          />
          <input
            name='confirmPassword'
            type='password'
            required
            minLength={8}
            autoComplete='new-password'
            placeholder={_('Confirm new password')}
            className={INPUT_CLASS}
            disabled={saving}
          />
          {error && (
            <p role='alert' className='text-error text-sm'>
              {error}
            </p>
          )}
          <button type='submit' className='btn btn-primary rounded-lg' disabled={saving}>
            {saving && <span className='loading loading-spinner loading-sm' aria-hidden='true' />}
            {_('Save')}
          </button>
        </form>
      )}
    </>
  );
};

export default AccountActions;
