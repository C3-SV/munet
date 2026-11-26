import Image from "next/image";
import Link from "next/link";
import { BrandAttribution } from "../../components/layout/BrandAttribution";
import { Button } from "../../components/ui/Button";
import { MunEsenLogo } from "../../components/layout/MunEsenLogo";

const sections = [
    { id: "primeros-pasos", label: "Primeros pasos" },
    { id: "participantes", label: "Para participantes" },
    { id: "organizadores", label: "Para organizadores" },
    { id: "importar", label: "Importar CSV" },
    { id: "preguntas", label: "Preguntas frecuentes" },
];

const steps = (items: { title: string; text: string }[]) => (
    <ol className="mt-5 space-y-4">
        {items.map((item, index) => (
            <li key={item.title} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--sidebar-active-bg)] text-xs font-bold text-[var(--text-accent)]">
                    {String(index + 1).padStart(2, "0")}
                </span>
                <div className="pt-0.5">
                    <h4 className="font-semibold text-[var(--text-primary)]">{item.title}</h4>
                    <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{item.text}</p>
                </div>
            </li>
        ))}
    </ol>
);

function SectionHeading({ title, description }: { title: string; description: string }) {
    return (
        <div className="max-w-prose">
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-[var(--text-primary)] sm:text-4xl">{title}</h2>
            <p className="mt-3 text-base leading-7 text-[var(--text-secondary)]">{description}</p>
        </div>
    );
}

function TopicCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
    return (
        <article className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-sm)] sm:p-7">
            <h3 className="text-lg font-bold text-[var(--text-primary)]">{title}</h3>
            {description && <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>}
            {children}
        </article>
    );
}

export default function GuidePage() {
    return (
        <main className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
            <header className="border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
                    <Link href="/guia" aria-label="MUNET, guía de uso" className="inline-flex items-center gap-3">
                        <Image src="/logo-munet.png" alt="MUNET" className="h-10 w-auto" width={954} height={299} unoptimized />
                        <span className="hidden border-l border-[var(--border-color)] pl-3 text-sm font-semibold text-[var(--text-secondary)] sm:block">Guía de uso</span>
                    </Link>
                    <Link href="/login" className="rounded-full border border-[var(--border-color)] px-4 py-2 text-sm font-semibold text-[var(--text-accent)] transition-colors hover:bg-[var(--bg-hover)]">
                        Ir a iniciar sesión <span aria-hidden="true">↗</span>
                    </Link>
                </div>
            </header>

            <section className="relative overflow-hidden border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
                <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-2/5 bg-[linear-gradient(135deg,transparent_48%,var(--sidebar-active-bg)_48%,var(--sidebar-active-bg)_70%,transparent_70%)] opacity-70 lg:block" />
                <div className="relative mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
                    <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight text-[var(--text-primary)] sm:text-6xl">Guía de uso</h1>
                    <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--text-secondary)]">Todo lo que necesitas saber para utilizar MUNET: activa tu cuenta, encuentra tu comité y mantente al día durante el evento.</p>
                    <div className="mt-8 flex flex-wrap gap-3">
                        <Button href="#primeros-pasos">Empezar</Button>
                    </div>
                </div>
            </section>

            <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16 lg:py-16">
                <aside className="lg:sticky lg:top-8 lg:h-fit">
                    <p className="mb-3 px-3 text-xs font-bold text-[var(--text-secondary)]">En esta guía</p>
                    <nav aria-label="Secciones de la guía" className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1">
                        {sections.map((section) => (
                            <a key={section.id} href={`#${section.id}`} className="group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]">
                                <span>{section.label}</span>
                            </a>
                        ))}
                    </nav>
                </aside>

                <div className="min-w-0 space-y-20">
                    <section id="primeros-pasos" className="scroll-mt-8">
                        <SectionHeading title="Primeros pasos" description="MUNET reúne la información y las conversaciones de tu Modelo de Naciones Unidas en un espacio organizado por evento." />
                        <div className="mt-8 grid gap-4 sm:grid-cols-2">
                            <TopicCard title="Una cuenta para tu participación">
                                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">El equipo organizador crea las cuentas y asigna un evento. Para empezar, recibirás un código de ingreso y una contraseña inicial. Si participas en más de un evento, podrás elegir entre los que están asociados a tu cuenta.</p>
                            </TopicCard>
                            <TopicCard title="Activa tu cuenta">
                                {steps([
                                    { title: "Abre el inicio de sesión", text: "Ve a MUNET y selecciona Activar Cuenta." },
                                    { title: "Busca tu invitación", text: "Escribe el código que te entregó la organización y elige tu evento si aparece más de uno." },
                                    { title: "Crea tu contraseña", text: "Ingresa la contraseña inicial, elige una contraseña nueva y confírmala. La inicial deja de servir al activar la cuenta." },
                                    { title: "Entra a MUNET", text: "Vuelve a Iniciar sesión con tu código y la contraseña nueva." },
                                ])}
                            </TopicCard>
                        </div>
                        <div className="mt-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface-secondary)] p-5 sm:p-6">
                            <h3 className="font-semibold">Elegir un evento</h3>
                            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Si tienes varias participaciones o una cuenta organizadora, MUNET te lleva a <strong className="font-semibold text-[var(--text-primary)]">Cambiar evento</strong> para elegir dónde trabajar. Una sola participación puede abrir directamente el muro general. Puedes cambiar de evento desde la navegación cuando lo necesites.</p>
                        </div>
                    </section>

                    <section id="participantes" className="scroll-mt-8">
                        <SectionHeading title="Tu espacio en el evento" description="Al entrar, verás la navegación de tu evento, tu comité y las herramientas disponibles para tu participación." />
                        <div className="mt-8 grid gap-4 sm:grid-cols-2">
                            <TopicCard title="Encuentra tu comité">
                                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">El equipo organizador asigna tu comité. Puedes identificarlo en tu perfil y en la navegación de muros. Si no aparece o necesitas cambiarlo, contacta al equipo organizador del evento.</p>
                            </TopicCard>
                            <TopicCard title="Muros y publicaciones">
                                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">El muro <strong className="font-semibold text-[var(--text-primary)]">General</strong> reúne publicaciones del evento. <strong className="font-semibold text-[var(--text-primary)]">Avisos</strong> muestra comunicados de la organización. El muro de tu comité es el espacio de conversación de tu grupo.</p>
                                <ul className="mt-4 space-y-2 text-sm leading-6 text-[var(--text-secondary)]">
                                    <li><span className="mr-2 text-[var(--text-accent)]">↗</span>En General o en el muro de tu comité, escribe una publicación y selecciona <strong className="text-[var(--text-primary)]">Publicar</strong>.</li>
                                    <li><span className="mr-2 text-[var(--text-accent)]">↗</span>En <strong className="text-[var(--text-primary)]">Encuesta</strong>, añade de 2 a 10 opciones y publícala. Puedes cambiar tu voto mientras siga abierta.</li>
                                    <li><span className="mr-2 text-[var(--text-accent)]">↗</span>Pulsa el botón de comentarios bajo la publicación: muestra cuántos van y abre la conversación para comentar o responder.</li>
                                    <li><span className="mr-2 text-[var(--text-accent)]">↗</span>Usa <strong className="text-[var(--text-primary)]">Recientes</strong> o <strong className="text-[var(--text-primary)]">Antiguos</strong> para ordenar el muro y la búsqueda para encontrar una publicación. En General, filtra por comité con las etiquetas.</li>
                                    <li><span className="mr-2 text-[var(--text-accent)]">↗</span>Cada publicación y mensaje muestra la fecha y la hora en que se envió.</li>
                                </ul>
                                <p className="mt-4 rounded-xl bg-[var(--bg-surface-secondary)] p-3 text-xs leading-5 text-[var(--text-secondary)]">El botón <strong className="text-[var(--text-primary)]">Adjuntar</strong> del editor ya permite elegir una imagen JPG o PNG (hasta 5 MB) o un PDF (hasta 20 MB), pero por ahora el archivo no se guarda: la publicación sale solo con el texto.</p>
                                <p className="mt-4 rounded-xl bg-[var(--bg-surface-secondary)] p-3 text-xs leading-5 text-[var(--text-secondary)]">Los avisos oficiales los publica la administración. Los participantes no pueden publicar ni comentar en ese muro.</p>
                            </TopicCard>
                            <TopicCard title="Tu perfil">
                                {steps([
                                    { title: "Abre Perfil", text: "Consulta la información de tu participación, tu comité y tu código de delegación si aparece." },
                                    { title: "Edita tus datos visibles", text: "Cambia el nombre mostrado, el alias o la biografía en el formulario y pulsa Guardar perfil. Deja el alias vacío si quieres quitarlo." },
                                    { title: "Actualiza tu fotografía", text: "Elige una imagen JPG, PNG o WebP de hasta 5 MB y pulsa Subir foto." },
                                ])}
                                <p className="mt-4 text-xs leading-5 text-[var(--text-secondary)]">Tu cuenta, código de ingreso, evento, comité e institución son administrados por la organización.</p>
                            </TopicCard>
                            <TopicCard title="Mensajes directos">
                                {steps([
                                    { title: "Busca una persona", text: "Abre Mensajes Directos y escribe su nombre en el buscador." },
                                    { title: "Abre la conversación", text: "Selecciona a la persona. MUNET abre una conversación existente o inicia una nueva." },
                                    { title: "Envía y vuelve a consultar", text: "Escribe tu mensaje en la conversación. Desde Mensajes Directos puedes regresar al historial." },
                                ])}
                                <p className="mt-4 text-xs leading-5 text-[var(--text-secondary)]">Los mensajes directos son individuales y están disponibles entre participantes activos del mismo evento.</p>
                            </TopicCard>
                        </div>
                    </section>


                    <section id="preguntas" className="scroll-mt-8">
                        <SectionHeading title="Preguntas frecuentes" description="Resuelve las dudas habituales sobre tu cuenta y la participación en el evento." />
                        <div className="mt-8 divide-y divide-[var(--border-color)] rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-5 sm:px-7">
                            {[
                                ["¿Olvidaste tu contraseña?", "Contacta al equipo organizador de tu evento. Puede restablecerla y entregarte una contraseña temporal. Luego vuelve a iniciar sesión con el código de ingreso."],
                                ["¿Tu código no funciona?", "Comprueba que lo escribiste tal como te lo entregaron y que estás usando la contraseña correspondiente. Si todavía no puedes activar tu cuenta o entrar, contacta al equipo organizador."],
                                ["¿Cómo sabes cuál es tu comité?", "Consulta tu perfil o la navegación del evento. Si no aparece, pregunta al equipo organizador si tu cuenta ya tiene un comité asignado."],
                                ["¿Puedes cambiar tus datos?", "Puedes editar tu nombre visible, alias, biografía y fotografía desde Perfil. Para cambiar tu comité, código de ingreso, evento, rol o institución, solicita ayuda a la organización."],
                                ["¿Por qué no puedes publicar en Avisos?", "Ese muro está reservado para los comunicados de la administración. Puedes participar en el muro General y en el de tu comité según los permisos del evento."],
                                ["¿Puedes comunicarte con otro comité?", "Puedes buscar participantes activos de tu mismo evento en Mensajes Directos. El muro de comité se limita al comité que tienes asignado."],
                                ["¿No aparece tu evento?", "Puede que tu cuenta todavía no tenga una participación activa en ese evento. Contacta al equipo organizador para confirmar el código y la asignación."],
                            ].map(([question, answer]) => (
                                <details key={question} className="group py-5">
                                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-[var(--text-primary)] marker:hidden">
                                        {question}
                                        <span aria-hidden="true" className="text-xl font-normal text-[var(--text-accent)] transition-transform group-open:rotate-45">+</span>
                                    </summary>
                                    <p className="mt-3 max-w-prose pr-8 text-sm leading-6 text-[var(--text-secondary)]">{answer}</p>
                                </details>
                            ))}
                        </div>
                    </section>
                    <section id="organizadores" className="scroll-mt-8 border-t border-[var(--border-color)] pt-16">
                        <SectionHeading title="Herramientas para organizadores" description="Administra el evento donde tienes permisos. Las operaciones disponibles aparecen en el panel y dependen del evento seleccionado." />
                        <div className="mt-8 space-y-4">
                            <TopicCard title="Eventos">
                                {steps([
                                    { title: "Abre el panel", text: "Selecciona un evento que ya administras y entra a Eventos. La opción Cambiar evento también aparece en el panel." },
                                    { title: "Consulta tus eventos", text: "En Eventos revisa la lista. Cada fila tiene tres iconos: Participantes, Comités y Configurar. Pulsa Nuevo evento para abrir el formulario de creación." },
                                    { title: "Completa los datos", text: "Añade nombre y slug. Si quieres, incluye descripción y fechas. Pulsa Crear evento y edita los datos disponibles desde su ficha." },
                                ])}
                                <p className="mt-4 rounded-xl bg-[var(--bg-surface-secondary)] p-3 text-xs leading-5 text-[var(--text-secondary)]">Si el evento no aparece en tu lista o no abre sus muros, coordina con la organización general de MUNET antes de incorporar participantes.</p>
                            </TopicCard>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <TopicCard title="Comités y sus muros">
                                    {steps([
                                        { title: "Abre Comités", text: "Usa Comités en la navegación de la izquierda, o el panel de inicio, y elige Nuevo comité." },
                                        { title: "Registra el comité", text: "Escribe el nombre y el código. Puedes añadir descripción y orden." },
                                        { title: "Edita si hace falta", text: "En el listado, pulsa el icono de lápiz de la fila para actualizar los datos disponibles. Al crear un comité, MUNET también crea su muro." },
                                    ])}
                                </TopicCard>
                                <TopicCard title="Registra participantes">
                                    {steps([
                                        { title: "Abre Participantes", text: "En el evento seleccionado, pulsa Nuevo participante." },
                                        { title: "Completa el formulario", text: "Indica código, rol, nombre y apellido. Si corresponde, elige comité y añade delegación, institución o datos del perfil." },
                                        { title: "Entrega sus credenciales", text: "Pulsa Crear participante. Copia la contraseña inicial que aparece y entrégala junto al código de ingreso de forma privada." },
                                    ])}
                                    <p className="mt-4 text-xs leading-5 text-[var(--text-secondary)]">La contraseña inicial se muestra una sola vez. Usa códigos de ingreso distintos para cada participante. Para varias cuentas a la vez, usa <strong className="text-[var(--text-primary)]">Importar CSV</strong> (ver la sección siguiente).</p>
                                </TopicCard>
                                <TopicCard title="Lista, asigna y edita">
                                    <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">En Participantes puedes filtrar por comité, rol y estado. Abre una ficha para editar los datos disponibles o cambiar su comité. También puedes quitar la asignación con <strong className="text-[var(--text-primary)]">Sin comité</strong>. Pulsa <strong className="text-[var(--text-primary)]">Guardar cambios</strong> para aplicar la edición.</p>
                                </TopicCard>
                                <TopicCard title="Restablece o suspende una cuenta">
                                    <ul className="mt-3 space-y-3 text-sm leading-6 text-[var(--text-secondary)]">
                                        <li><strong className="text-[var(--text-primary)]">Restablecer contraseña:</strong> en la ficha, pulsa Restablecer contraseña y entrega la clave temporal de forma privada. Aparece una sola vez.</li>
                                        <li><strong className="text-[var(--text-primary)]">Suspender cuenta:</strong> pulsa Suspender cuenta e introduce el motivo.</li>
                                        <li><strong className="text-[var(--text-primary)]">Reactivar cuenta:</strong> pulsa Reactivar cuenta e introduce el motivo. Después, la persona puede volver a entrar.</li>
                                    </ul>
                                    <p className="mt-4 text-xs leading-5 text-[var(--text-secondary)]">Si se suspende una cuenta antes de que su titular la active, consulta con la organización general antes de reactivarla.</p>
                                </TopicCard>
                                <TopicCard title="Publica avisos y gestiona contenido">
                                    <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Abre el muro <strong className="text-[var(--text-primary)]">Avisos</strong> del evento para publicar y comentar como administración. En los muros donde tengas acceso, usa el control del post o comentario para retirar contenido cuando corresponda.</p>
                                </TopicCard>
                            </div>
                        </div>
                    </section>

                    <section id="importar" className="scroll-mt-8 border-t border-[var(--border-color)] pt-16">
                        <SectionHeading title="Importar participantes por CSV" description="Carga varias cuentas a la vez. MUNET revisa el archivo antes de crear nada: solo se crean las filas válidas, y puedes corregir y volver a subir cuantas veces haga falta." />

                        <div className="mt-8 grid gap-4 sm:grid-cols-2">
                            <TopicCard title="Antes de subir el archivo">
                                {steps([
                                    { title: "Descarga la plantilla", text: "En Participantes, pulsa Importar CSV y luego Descargar plantilla. Reemplaza la fila de ejemplo por tus datos." },
                                    { title: "Guarda en UTF-8", text: "En Excel usa Guardar como → CSV UTF-8 para conservar tildes y eñes. El separador puede ser coma o punto y coma." },
                                    { title: "Revisa comités y roles", text: "El comité puede ir por nombre o código. Si no existe en el evento, MUNET lo crea al importar con su muro." },
                                ])}
                            </TopicCard>

                            <TopicCard title="Columnas del archivo" description="Las tres primeras son obligatorias.">
                                <div className="mt-4 overflow-x-auto">
                                    <table className="w-full text-left text-xs leading-5 text-[var(--text-secondary)]">
                                        <thead>
                                            <tr className="border-b border-[var(--border-color)] text-[var(--text-primary)]">
                                                <th className="py-2 pr-3 font-semibold">Columna</th>
                                                <th className="py-2 font-semibold">Qué escribir</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--border-light)]">
                                            <tr><td className="py-2 pr-3 font-semibold text-[var(--text-primary)]">nombre</td><td className="py-2">Obligatorio. Hasta 100 caracteres.</td></tr>
                                            <tr><td className="py-2 pr-3 font-semibold text-[var(--text-primary)]">apellido</td><td className="py-2">Obligatorio. Hasta 100 caracteres.</td></tr>
                                            <tr><td className="py-2 pr-3 font-semibold text-[var(--text-primary)]">codigo_participante</td><td className="py-2">Obligatorio. De 3 a 50 caracteres: letras, números, punto, guion o guion bajo. Único en el evento.</td></tr>
                                            <tr><td className="py-2 pr-3 font-semibold text-[var(--text-primary)]">comite</td><td className="py-2">Nombre o código. Vacío significa sin comité.</td></tr>
                                            <tr><td className="py-2 pr-3 font-semibold text-[var(--text-primary)]">delegacion</td><td className="py-2">Opcional. Hasta 120 caracteres.</td></tr>
                                            <tr><td className="py-2 pr-3 font-semibold text-[var(--text-primary)]">rol</td><td className="py-2">Opcional. Vacío es participante. Ver la tabla de roles.</td></tr>
                                            <tr><td className="py-2 pr-3 font-semibold text-[var(--text-primary)]">alias</td><td className="py-2">Opcional. Hasta 60 caracteres.</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </TopicCard>

                            <TopicCard title="Roles que admite el CSV">
                                <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--text-secondary)]">
                                    <li><strong className="text-[var(--text-primary)]">Participante</strong> (o vacío, delegado): acceso al evento y a su comité.</li>
                                    <li><strong className="text-[var(--text-primary)]">Moderador</strong>: modera los muros del evento desde el panel.</li>
                                    <li><strong className="text-[var(--text-primary)]">Administrador MUN</strong> (escribe <em>ADMIN_MUN</em>, <em>Admin</em> o <em>Administrador MUN</em>): administra el evento.</li>
                                    <li><strong className="text-[var(--text-primary)]">Administrador técnico</strong>: no se importa por CSV. Créalo uno por uno desde Participantes.</li>
                                </ul>
                            </TopicCard>

                            <TopicCard title="Importar paso a paso">
                                {steps([
                                    { title: "Sube el archivo", text: "Elige el .csv. MUNET lo revisa y no crea ninguna cuenta todavía." },
                                    { title: "Revisa las pestañas", text: "Válidas se crearán. Con errores no se importan: corrige el archivo y vuelve a subirlo. Duplicadas ya existen en el evento o aparecen dos veces; tampoco se importan." },
                                    { title: "Confirma", text: "Pulsa Importar seguido del número de filas válidas. Las cuentas se crean en lotes; no cierres la pestaña mientras avanza." },
                                    { title: "Descarga las credenciales", text: "Antes de salir, descarga el CSV de credenciales. Las contraseñas iniciales se muestran una sola vez y no se pueden recuperar." },
                                ])}
                            </TopicCard>

                            <TopicCard title="Verifica el resultado">
                                {steps([
                                    { title: "Compara los números", text: "Creadas debe coincidir con las filas válidas. Fallidas y Sin procesar deben ser 0 o explicarse por las filas con error." },
                                    { title: "Revisa la lista", text: "En Participantes filtra por comité y rol. Cada comité nuevo debe aparecer con sus participantes." },
                                    { title: "Prueba una cuenta", text: "Abre la ficha de una persona y confirma comité, rol y código. Para comprobar el acceso, entra con una ventana privada usando el código y la contraseña inicial; la cuenta debe pedir activación." },
                                ])}
                            </TopicCard>

                            <TopicCard title="Errores frecuentes y cómo resolverlos">
                                <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--text-secondary)]">
                                    <li><strong className="text-[var(--text-primary)]">Faltan encabezados obligatorios:</strong> la primera fila debe tener nombre, apellido y codigo_participante. Si copiaste desde una hoja de cálculo, guarda el archivo como CSV.</li>
                                    <li><strong className="text-[var(--text-primary)]">Rol no permitido:</strong> usa participante, moderador o administrador MUN.</li>
                                    <li><strong className="text-[var(--text-primary)]">Comité archivado:</strong> el nombre o código pertenece a un comité archivado. Restáuralo en Comités o usa otro nombre.</li>
                                    <li><strong className="text-[var(--text-primary)]">Ya existe un comité eliminado:</strong> un comité borrado conserva su nombre y código. Restáuralo o cambia el nombre en el archivo.</li>
                                    <li><strong className="text-[var(--text-primary)]">codigo_participante ya existe:</strong> el código lo usa otra persona del evento. Cámbialo.</li>
                                    <li><strong className="text-[var(--text-primary)]">Límites:</strong> hasta 1000 filas por archivo y 30 comités nuevos por importación.</li>
                                </ul>
                            </TopicCard>
                        </div>
                    </section>
                </div>
            </div>

            <footer className="border-t border-[var(--border-color)] bg-[var(--bg-surface)]">
                <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                    <div className="flex items-center gap-3">
                        <MunEsenLogo className="h-8 w-auto" />
                        <p className="text-xs text-[var(--text-secondary)]">© {new Date().getFullYear()} MUN ESEN</p>
                    </div>
                    <BrandAttribution />
                </div>
            </footer>
        </main>
    );
}
