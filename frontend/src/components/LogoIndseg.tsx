interface Props {
  /** 'full' = logo image + INDSEG + tagline  |  'compact' = logo image + INDSEG  |  'icon' = logo image only */
  variant?: 'full' | 'compact' | 'icon'
  iconSize?: number
  className?: string
  /** Force light text (for dark backgrounds) */
  light?: boolean
}

export default function LogoIndseg({ variant = 'compact', iconSize = 36, className = '', light = false }: Props) {
  const textColor = light ? 'text-white' : 'text-slate-800'
  const subColor  = light ? 'text-slate-300' : 'text-slate-500'

  const mark = (
    <img
      src="/logo-indseg.jpg"
      alt="INDSEG"
      style={{ width: iconSize, height: iconSize, objectFit: 'contain' }}
      className="shrink-0"
    />
  )

  if (variant === 'icon') return mark

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {mark}
      <div>
        <p className={`font-black tracking-widest uppercase leading-none ${textColor}`}
           style={{ fontSize: iconSize * 0.44, letterSpacing: '0.12em' }}>
          INDSEG
        </p>
        {variant === 'full' && (
          <p className={`uppercase tracking-widest leading-none mt-0.5 ${subColor}`}
             style={{ fontSize: iconSize * 0.2, letterSpacing: '0.1em' }}>
            Indumentaria Segura
          </p>
        )}
      </div>
    </div>
  )
}
