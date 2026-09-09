import {
  AnimatePresence,
  motion,
  type MotionValue,
  type SpringOptions,
  useMotionValue,
  useSpring,
  useTransform,
} from 'motion/react';
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cn } from '@/src/lib/utils';

const DEFAULT_MAGNIFICATION = 56;
const DEFAULT_DISTANCE = 90;
const DEFAULT_PANEL_HEIGHT = 58;

type DockProps = {
  children: ReactNode;
  className?: string;
  distance?: number;
  panelHeight?: number;
  magnification?: number;
  spring?: SpringOptions;
};

type InjectedDockProps = {
  width?: MotionValue<number>;
  isHovered?: MotionValue<number>;
};

type DockChildProps = InjectedDockProps & {
  className?: string;
  children: ReactNode;
};

type DockContextValue = {
  mouseX: MotionValue<number>;
  spring: SpringOptions;
  magnification: number;
  distance: number;
};

const DockContext = createContext<DockContextValue | undefined>(undefined);

function useDock() {
  const context = useContext(DockContext);
  if (!context) throw new Error('useDock must be used within Dock');
  return context;
}

function Dock({
  children,
  className,
  spring = { mass: 0.1, stiffness: 180, damping: 15 },
  magnification = DEFAULT_MAGNIFICATION,
  distance = DEFAULT_DISTANCE,
  panelHeight = DEFAULT_PANEL_HEIGHT,
}: DockProps) {
  const pointerX = useMotionValue(Infinity);
  const isInteracting = useMotionValue(0);
  const expandedHeight = useMemo(
    () => Math.max(panelHeight, magnification + 18),
    [magnification, panelHeight],
  );
  const heightTarget = useTransform(
    isInteracting,
    [0, 1],
    [panelHeight, expandedHeight],
  );
  const height = useSpring(heightTarget, spring);

  const resetPointer = () => {
    isInteracting.set(0);
    pointerX.set(Infinity);
  };

  return (
    <motion.div
      className="flex max-w-full items-end overflow-visible"
      style={{ height }}
    >
      <motion.div
        role="toolbar"
        aria-label="Navegação principal"
        onPointerEnter={() => isInteracting.set(1)}
        onPointerMove={(event) => {
          isInteracting.set(1);
          pointerX.set(event.clientX);
        }}
        onPointerLeave={resetPointer}
        onPointerCancel={resetPointer}
        className={cn(
          'flex w-fit items-end gap-1 rounded-[1.35rem] border border-zinc-200/80 bg-white/95 px-3 shadow-[0_16px_45px_rgba(0,0,0,0.24)] backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/95',
          className,
        )}
        style={{ height: panelHeight }}
      >
        <DockContext.Provider value={{ mouseX: pointerX, spring, distance, magnification }}>
          {children}
        </DockContext.Provider>
      </motion.div>
    </motion.div>
  );
}

function DockItem({ children, className }: DockChildProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { distance, magnification, mouseX, spring } = useDock();
  const isHovered = useMotionValue(0);
  const mouseDistance = useTransform(mouseX, (value) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return Infinity;
    return value - rect.left - rect.width / 2;
  });
  const widthTarget = useTransform(
    mouseDistance,
    [-distance, 0, distance],
    [44, magnification, 44],
  );
  const width = useSpring(widthTarget, spring);

  return (
    <motion.div
      ref={ref}
      style={{ width }}
      onHoverStart={() => isHovered.set(1)}
      onHoverEnd={() => isHovered.set(0)}
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
    >
      {Children.map(children, (child) =>
        isValidElement(child)
          ? cloneElement(child as ReactElement<InjectedDockProps>, { width, isHovered })
          : child,
      )}
    </motion.div>
  );
}

function DockLabel({ children, className, isHovered }: DockChildProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!isHovered) return;
    return isHovered.on('change', (value) => setIsVisible(value === 1));
  }, [isHovered]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.span
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          className={cn(
            'pointer-events-none absolute -top-9 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[10px] font-bold text-zinc-700 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100',
            className,
          )}
          role="tooltip"
        >
          {children}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

function DockIcon({ children, className, width }: DockChildProps) {
  const fallbackWidth = useMotionValue(44);
  const iconWidth = useTransform(width ?? fallbackWidth, (value) => value * 0.66);

  return (
    <motion.span
      style={{ width: iconWidth, height: iconWidth }}
      className={cn('flex items-center justify-center', className)}
    >
      {children}
    </motion.span>
  );
}

export { Dock, DockIcon, DockItem, DockLabel };
