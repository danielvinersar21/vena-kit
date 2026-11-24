import type { ScreenModel } from '../model';
import { Assistant, type AssistantProps } from './Assistant';
import { Background } from './Background';
import { Header } from './Header';
import { Rooms, type RoomActions } from './Rooms';
import { Yard } from './Yard';

export type ScreenActions = RoomActions & Pick<AssistantProps, 'onSubmitText' | 'onMicDown' | 'onMicUp'>;

// Ecranul principal: 3 coloane (camere / orb / curte + jurnal), ca în design/static.
export function Screen({ model, actions = {} }: { model: ScreenModel; actions?: ScreenActions }) {
  return (
    <div className="relative w-full min-h-[900px] box-border bg-bg overflow-hidden">
      <Background {...model.background} />
      <div className="relative z-[1] min-h-[900px] box-border text-text font-display px-[32px] py-[24px] flex flex-col gap-[20px]">
        <Header location={model.location} status={model.status} />
        <main className="grid grid-cols-[minmax(260px,1fr)_minmax(380px,1.4fr)_minmax(300px,1.1fr)] max-[1100px]:grid-cols-1 gap-[24px] flex-1">
          <Rooms rooms={model.rooms} onToggle={actions.onToggle} onSetpoint={actions.onSetpoint} />
          <Assistant
            orb={model.orb}
            stateLabel={model.stateLabel}
            conversation={model.conversation}
            micActive={model.micActive}
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
