import { Avatar } from './Avatar';
import type { TripMember } from '../types';

interface AvatarStackProps {
  members: Pick<TripMember, 'userId' | 'displayName' | 'photoURL'>[];
  max?: number;
  size?: 'sm' | 'md';
}

export function AvatarStack({ members, max = 4, size = 'sm' }: AvatarStackProps) {
  const visible = members.slice(0, max);
  const overflow = members.length - max;
  const overlapClass = size === 'sm' ? '-ml-1.5' : '-ml-2';
  const overflowSizeClass = size === 'sm' ? 'w-[26px] h-[26px] text-[10px]' : 'w-[34px] h-[34px] text-[13px]';

  return (
    <div className="flex items-center">
      {visible.map((m, i) => (
        <Avatar
          key={m.userId}
          displayName={m.displayName}
          photoURL={m.photoURL}
          size={size}
          className={i > 0 ? overlapClass : ''}
        />
      ))}
      {overflow > 0 && (
        <div
          className={[
            'rounded-full flex items-center justify-center flex-shrink-0',
            'bg-wb-paper-3 text-wb-ink-soft font-bold border-2 border-white',
            overlapClass,
            overflowSizeClass,
          ].join(' ')}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
