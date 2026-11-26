// Confirmaciones de lectura de mensajes directos.
//
// Un mensaje propio está «enviado» hasta que la otra persona lo lee; entonces pasa a «leído».
// No existe el estado «entregado»: no hay una confirmación fiable de que llegó al dispositivo.

export type ReadableMessage = {
    id: string;
    senderId: string;
    readAt?: string | null;
};

export type MessageReadState = "sent" | "read";

// Estado de un mensaje propio.
export const messageReadState = (message: ReadableMessage): MessageReadState =>
    message.readAt ? "read" : "sent";

// ¿Hay mensajes de la otra persona que esta persona todavía no ha leído?
export const hasUnreadIncoming = (messages: ReadableMessage[], myId: string | null): boolean =>
    Boolean(myId) && messages.some((message) => message.senderId !== myId && !message.readAt);

// Marca en pantalla como leídos los mensajes recibidos, sin tocar los propios.
export const markIncomingReadLocally = <T extends ReadableMessage>(
    messages: T[],
    myId: string | null,
    readAt: string,
): T[] =>
    messages.map((message) =>
        message.senderId !== myId && !message.readAt ? { ...message, readAt } : message,
    );

// Un mensaje se marca como leído solo si la persona realmente lo está viendo: pestaña visible,
// ventana activa y conversación desplazada al final. Recibirlo no basta.
export const shouldMarkRead = (state: {
    hasUnread: boolean;
    tabVisible: boolean;
    windowFocused: boolean;
    nearBottom: boolean;
    loaded: boolean;
}): boolean =>
    state.loaded && state.hasUnread && state.tabVisible && state.windowFocused && state.nearBottom;
