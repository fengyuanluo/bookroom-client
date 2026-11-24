import { PiUserCircle } from 'react-icons/pi';
import { useTranslation } from '@/hooks/useTranslation';
import type { BookRoomUser } from '@/services/bookroom/session';

interface UserInfoProps {
  user: BookRoomUser;
  server: string;
}

const UserInfo: React.FC<UserInfoProps> = ({ user, server }) => {
  const _ = useTranslation();
  return (
    <div className='flex flex-col items-center gap-x-6 gap-y-2 md:flex-row md:items-center'>
      <PiUserCircle className='aspect-square h-16 w-16 shrink-0 md:h-24 md:w-24' />
      <div className='grow text-center md:text-left'>
        <h2 className='text-base-content text-xl font-bold md:text-2xl' dir='auto'>
          {user.username}
        </h2>
        {user.email && <p className='text-base-content/60'>{user.email}</p>}
        <p className='text-base-content/60 break-all text-sm'>{server}</p>
        {user.isAdmin && (
          <div className='mt-3'>
            <span className='bg-base-300 text-base-content inline-block rounded-full px-3 py-1 text-sm font-medium'>
              {_('Administrator')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserInfo;
