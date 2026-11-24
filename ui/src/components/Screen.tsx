import { useEffect, useState } from 'react';
import type { ScreenModel } from '../model';
import { Assistant, type AssistantProps } from './Assistant';
import { Background } from './Background';
import { Header } from './Header';
import { Rooms, type RoomActions } from './Rooms';
import { Yard } from './Yard';

export type ScreenActions = RoomActions & Pick<AssistantProps, 'onSubmitText' | 'onMicDown' | 'onMicUp' | 'onConfirm' | 'onCancelConfirm' | 'onRetry'>;

// Ecranul principal: 3 coloane (camere / orb / curte + jurnal), ca în design/static.
// Designul e făcut pe 1440×900. Pe ecrane mai mari, tot UI-ul se mărește proporțional (zoom),
// cât încape și pe lățime, și pe înălțime; ecranul umple mereu toată înălțimea ferestrei.
const DESIGN_W = 1440;
const DESIGN_H = 900;

function useViewport() {
  const read = () => ({ w: window.innerWidth, h: window.innerHeight });
  const [vp, setVp] = useState(read);
  useEffect(() => {
    const on = () => setVp(read());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return vp;
}

export function Screen({ model, actions = {} }: { model: ScreenModel; actions?: ScreenActions }) {
  const { w, h } = useViewport();
  const scale = Math.max(1, Math.min(w / DESIGN_W, h / DESIGN_H));
  // Cu zoom, lungimile CSS se înmulțesc cu scale; înălțimea minimă e deci fereastra împărțită la scale.
  const minHeight = Math.max(DESIGN_H, h / scale);
  return (
    <div className="relative w-full box-border bg-bg overflow-hidden" style={{ zoom: scale, minHeight }}>
      <Background {...model.background} />
      <div style={{ minHeight }} className="relative z-[1] box-border text-text font-display px-[32px] py-[24px] flex flex-col gap-[20px]">
        <Header location={model.location} status={model.status} offline={model.connection === 'offline'} />
        <main className="grid grid-cols-[minmax(260px,1fr)_minmax(380px,1.4fr)_minmax(300px,1.1fr)] max-[1100px]:grid-cols-1 gap-[24px] flex-1">
          <Rooms rooms={model.rooms} dimmed={model.connection === 'offline'} onToggle={actions.onToggle} onSetpoint={actions.onSetpoint} />
          <Assistant
            orb={model.orb}
            stateLabel={model.stateLabel}
            conversation={model.conversation}
            micActive={model.micActive}
            confirm={model.confirm}
            onConfirm={actions.onConfirm}
            onCancelConfirm={actions.onCancelConfirm}
            onRetry={actions.onRetry}
            onSubmitText={actions.onSubmitText}
            onMicDown={actions.onMicDown}
            onMicUp={actions.onMicUp}
          />
          <Yard camera={model.camera} tiles={model.tiles} journal={model.journal} />
        </main>
      </div>
    </div>
  );
}
