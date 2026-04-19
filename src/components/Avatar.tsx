type AvatarSize = 'sm' | 'md' | 'lg';

interface AvatarProps {
  displayName: string;
  photoURL?: string | null;
  size?: AvatarSize;
  className?: string;
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'w-[26px] h-[26px] text-[10px]',
  md: 'w-[34px] h-[34px] text-[13px]',
  lg: 'w-11 h-11 text-base',
};

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export function Avatar({ displayName, photoURL, size = 'md', className = '' }: AvatarProps) {
  const sizeClass = sizeClasses[size];

  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={displayName}
        className={[
          'rounded-full object-cover border-2 border-white flex-shrink-0',
          sizeClass,
          className,
        ].join(' ')}
      />
    );
  }

  return (
    <div
      title={displayName}
      className={[
        'rounded-full flex items-center justify-center flex-shrink-0',
        'bg-wb-sunset text-white font-bold border-2 border-white',
        sizeClass,
        className,
      ].join(' ')}
    >
      {getInitials(displayName)}
    </div>
  );
}
