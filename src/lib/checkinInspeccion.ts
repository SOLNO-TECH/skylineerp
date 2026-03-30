/** Estados tipo hoja física: ✔ / X / N/A */
export type Tri = '' | 'ok' | 'mal' | 'na';

export type ModalidadInspeccion = 'caja_seca' | 'refrigerado' | 'mulita_patio';

export const MODALIDAD_LABEL: Record<ModalidadInspeccion, string> = {
  caja_seca: 'Caja seca (remolque)',
  refrigerado: 'Refrigerado',
  mulita_patio: 'Mulita de patio',
};

export type InspeccionHeader = {
  folio: string;
  fechaInspeccion: string;
  conductor: string;
  nEconomico: string;
  /** Datos de la hoja impresa (caja seca), además del catálogo de unidad */
  hojaPlacas: string;
  hojaKm: string;
  hojaMarca: string;
  hojaTipo: string;
  camion: string;
  nivelCombustibleEscala: string;
  descripcionReparar: string;
  refacciones: string;
  mecanicoAsignado: string;
  firmaConformidad: string;
};

export type LlantaFila = {
  posicion: string;
  marca: string;
  modelo: string;
  mm: string;
  sellos: string;
};

export type InspeccionCajaSeca = {
  items: Record<string, Tri>;
  llantas: LlantaFila[];
  danosNotas: string;
};

/**
 * Inspección operativa de unidad de refrigeración (3 bloques en UI):
 * 1) Datos del equipo + condiciones + fugas; 2) Control de temperatura; 3) Prueba de funcionamiento.
 */
export type InspeccionRefrigeracion = {
  equipo: {
    marca: string;
    modelo: string;
    numeroSerie: string;
    horasMotor: string;
    tipoCombustible: string;
  };
  condiciones: {
    nivelDiesel: string;
    nivelAceite: string;
    nivelAnticongelante: string;
    estadoBateria: string;
    fugaAceite: Tri;
    fugaRefrigerante: Tri;
  };
  temperatura: {
    setPoint: string;
    tempActual: string;
    modoOperacion: string;
    lecturaDisplay: string;
    termografo: string;
    registroTemperatura: string;
  };
  prueba: Record<string, Tri>;
  /** Reservado por compatibilidad con registros antiguos (ya no se muestra en el formulario). */
  unidadFrigorifica: Record<string, Tri>;
};

export type InspeccionMulita = {
  datos: {
    operador: string;
    nEconomico: string;
    vinSerie: string;
    marca: string;
    modeloAnio: string;
    horasUso: string;
    ubicacion: string;
  };
  items: Record<string, Tri>;
  llantas: Array<{ posicion: string; estado: string; presion: string; danos: string }>;
};

export type InspeccionCompleta = {
  header: InspeccionHeader;
  cajaSeca: InspeccionCajaSeca;
  refrigeracion: InspeccionRefrigeracion;
  mulita: InspeccionMulita;
};

/** Checklist alineado con la hoja física SKYLINE · caja seca (✔ / X / N/A). */
export const CAJA_SECA_SECCIONES: { titulo: string; items: { id: string; label: string }[] }[] = [
  {
    titulo: 'Pared frontal',
    items: [
      { id: 'cs_pf_laminas', label: 'Láminas' },
      { id: 'cs_pf_estacas', label: 'Estacas' },
      { id: 'cs_pf_remaches', label: 'Remaches' },
      { id: 'cs_pf_esq_der', label: 'Esquinero derecho' },
      { id: 'cs_pf_esq_izq', label: 'Esquinero izquierdo' },
      { id: 'cs_pf_borda_sup', label: 'Borda superior' },
      { id: 'cs_pf_borda_inf', label: 'Borda inferior' },
    ],
  },
  {
    titulo: 'Pared lateral derecha',
    items: [
      { id: 'cs_pld_laminas', label: 'Láminas' },
      { id: 'cs_pld_estacas', label: 'Estacas' },
      { id: 'cs_pld_remaches', label: 'Remaches' },
      { id: 'cs_pld_borda_sup', label: 'Borda superior' },
      { id: 'cs_pld_borda_inf', label: 'Borda inferior' },
    ],
  },
  {
    titulo: 'Pared lateral izquierda',
    items: [
      { id: 'cs_pli_laminas', label: 'Láminas' },
      { id: 'cs_pli_estacas', label: 'Estacas' },
      { id: 'cs_pli_remaches', label: 'Remaches' },
      { id: 'cs_pli_borda_sup', label: 'Borda superior' },
      { id: 'cs_pli_borda_inf', label: 'Borda inferior' },
    ],
  },
  {
    titulo: 'Área trasera',
    items: [
      { id: 'cs_tr_puertas', label: 'Puertas' },
      { id: 'cs_tr_puertas_int', label: 'Puertas internas' },
      { id: 'cs_tr_bisagras', label: 'Bisagras' },
      { id: 'cs_tr_portabisagras', label: 'Portabisagras' },
      { id: 'cs_tr_herrajes', label: 'Herrajes' },
      { id: 'cs_tr_faldon', label: 'Faldón' },
      { id: 'cs_tr_empaques', label: 'Empaques' },
    ],
  },
  {
    titulo: 'Área interna',
    items: [
      { id: 'cs_in_pared_frontal', label: 'Pared frontal' },
      { id: 'cs_in_pared_der', label: 'Pared derecha' },
      { id: 'cs_in_pared_izq', label: 'Pared izquierda' },
      { id: 'cs_in_techo', label: 'Techo' },
      { id: 'cs_in_arcotecho', label: 'Arcotecho' },
      { id: 'cs_in_piso', label: 'Piso' },
      { id: 'cs_in_zoclo', label: 'Zoclo' },
    ],
  },
  {
    titulo: 'Área inferior',
    items: [
      { id: 'cs_inf_cargadores', label: 'Cargadores' },
      { id: 'cs_inf_patines', label: 'Patines' },
      { id: 'cs_inf_manivelas', label: 'Manivelas' },
      { id: 'cs_inf_plancha', label: 'Plancha' },
      { id: 'cs_inf_perno_rey', label: 'Perno rey' },
      { id: 'cs_inf_piso', label: 'Piso' },
    ],
  },
  {
    titulo: 'Suspensión',
    items: [
      { id: 'cs_susp_balatas', label: 'Balatas' },
      { id: 'cs_susp_bolsas', label: 'Bolsas' },
      { id: 'cs_susp_platos', label: 'Platos' },
      { id: 'cs_susp_baleros', label: 'Baleros' },
      { id: 'cs_susp_tambores', label: 'Tambores' },
      { id: 'cs_susp_amortiguadores', label: 'Amortiguadores' },
      { id: 'cs_susp_abs', label: 'Sistema ABS' },
      { id: 'cs_susp_aire', label: 'Sistema de aire' },
      { id: 'cs_susp_retenes', label: 'Retenes' },
      { id: 'cs_susp_rines', label: 'Rines' },
      { id: 'cs_susp_corrida_carrito', label: 'Corrida de carrito' },
    ],
  },
  {
    titulo: 'Chequeo de rutina importante',
    items: [
      { id: 'cs_rut_luces_tras', label: 'Luces traseras' },
      { id: 'cs_rut_luz_lat_der', label: 'Luces lateral derecha' },
      { id: 'cs_rut_luz_lat_izq', label: 'Luces lateral izquierda' },
      { id: 'cs_rut_topes', label: 'Topes' },
      { id: 'cs_rut_placa', label: 'Placa' },
      { id: 'cs_rut_porta_placa', label: 'Porta placa' },
      { id: 'cs_rut_luces_sup', label: 'Luces superiores' },
      { id: 'cs_rut_luces_abs', label: 'Luces ABS' },
      { id: 'cs_rut_cinta_refl', label: 'Cinta reflectante' },
      { id: 'cs_rut_calcas', label: 'Calcas' },
      { id: 'cs_rut_birlos', label: 'Birlos apretados' },
      { id: 'cs_rut_llantas', label: 'Llantas' },
    ],
  },
  {
    titulo: 'Filtraciones de luz y agua',
    items: [
      { id: 'cs_fil_techo', label: 'Techo' },
      { id: 'cs_fil_paredes', label: 'Paredes' },
      { id: 'cs_fil_piso', label: 'Piso' },
    ],
  },
];

export const REFRIGERACION_PRUEBA_IDS: { id: string; label: string }[] = [
  { id: 'rf_pr_encendido', label: 'Encendido correcto' },
  { id: 'rf_pr_compresor', label: 'Compresor funcionando' },
  { id: 'rf_pr_ventiladores', label: 'Ventiladores operando' },
  { id: 'rf_pr_evaporador', label: 'Evaporador sin hielo excesivo' },
  { id: 'rf_pr_respuesta', label: 'Respuesta al cambio de temperatura' },
];

/** Bloque «Unidad frigorífica» de la hoja (remolques refrigerados). */
export const REFRIGERACION_UNIDAD_FRIGO: { id: string; label: string }[] = [
  { id: 'rf_uf_tapas', label: 'Tapas' },
  { id: 'rf_uf_mantenimiento', label: 'Mantenimiento' },
];

/** Bloques 2–4 antes de la tabla de llantas (orden hoja «Mulita de patio»). */
export type MulitaSeccionDef = {
  titulo: string;
  /** Resalta en UI (p. ej. quinta rueda). */
  clave?: boolean;
  items: { id: string; label: string }[];
};

export const MULITA_SECCIONES_HASTA_LLANTAS: MulitaSeccionDef[] = [
  {
    titulo: '2 · Estado general de la unidad',
    items: [
      { id: 'mu_carroceria', label: 'Carrocería' },
      { id: 'mu_cabina', label: 'Cabina' },
      { id: 'mu_parabrisas', label: 'Parabrisas' },
      { id: 'mu_espejos', label: 'Espejos' },
      { id: 'mu_asiento', label: 'Asiento operador' },
      { id: 'mu_cinturon', label: 'Cinturón de seguridad' },
      { id: 'mu_limpieza', label: 'Limpieza interior' },
    ],
  },
  {
    titulo: '3 · Sistema de acople (quinta rueda)',
    clave: true,
    items: [
      { id: 'mu_q_desgaste', label: 'Quinta rueda (desgaste)' },
      { id: 'mu_q_seguro', label: 'Seguro de quinta' },
      { id: 'mu_q_apertura', label: 'Funcionamiento de apertura/cierre' },
      { id: 'mu_q_engrase', label: 'Engrase' },
      { id: 'mu_q_alineacion', label: 'Alineación con remolque' },
    ],
  },
  {
    titulo: '4 · Sistema hidráulico (elevación)',
    items: [
      { id: 'mu_h_elev', label: 'Funcionamiento de elevación' },
      { id: 'mu_h_desc', label: 'Descenso correcto' },
      { id: 'mu_h_fugas', label: 'Fugas hidráulicas' },
      { id: 'mu_h_nivel', label: 'Nivel de aceite hidráulico' },
      { id: 'mu_h_cilindros', label: 'Cilindros (estado)' },
      { id: 'mu_h_mangueras', label: 'Mangueras' },
    ],
  },
];

/** Bloques 6–12 después de la tabla de llantas. */
export const MULITA_SECCIONES_TRAS_LLANTAS: MulitaSeccionDef[] = [
  {
    titulo: '6 · Motor y fluidos',
    items: [
      { id: 'mu_m_aceite', label: 'Nivel de aceite' },
      { id: 'mu_m_anticongelante', label: 'Anticongelante' },
      { id: 'mu_m_diesel', label: 'Nivel de diésel' },
      { id: 'mu_m_fugas', label: 'Fugas (aceite / diésel)' },
      { id: 'mu_m_aire', label: 'Filtro de aire' },
    ],
  },
  {
    titulo: '7 · Sistema eléctrico',
    items: [
      { id: 'mu_e_bateria', label: 'Batería' },
      { id: 'mu_e_del', label: 'Luces delanteras' },
      { id: 'mu_e_tras', label: 'Luces traseras' },
      { id: 'mu_e_dir', label: 'Direccionales' },
      { id: 'mu_e_rev', label: 'Luces de reversa' },
      { id: 'mu_e_claxon', label: 'Claxon' },
    ],
  },
  {
    titulo: '8 · Conexiones al remolque',
    items: [
      { id: 'mu_r_lineas', label: 'Líneas de aire' },
      { id: 'mu_r_7vias', label: 'Conectores eléctricos (7 vías)' },
      { id: 'mu_r_soportes', label: 'Soportes de líneas' },
      { id: 'mu_r_luces_rem', label: 'Funcionamiento de luces del remolque' },
    ],
  },
  {
    titulo: '9 · Sistema de frenos',
    items: [
      { id: 'mu_fr_servicio', label: 'Frenos de servicio' },
      { id: 'mu_fr_estacionamiento', label: 'Freno de estacionamiento' },
      { id: 'mu_fr_presion', label: 'Presión de aire' },
      { id: 'mu_fr_fugas', label: 'Fugas de aire' },
    ],
  },
  {
    titulo: '10 · Suspensión',
    items: [
      { id: 'mu_s_bolsas', label: 'Bolsas de aire' },
      { id: 'mu_s_amort', label: 'Amortiguadores' },
      { id: 'mu_s_general', label: 'Estado general' },
    ],
  },
  {
    titulo: '11 · Seguridad operativa',
    items: [
      { id: 'mu_seg_reversa', label: 'Alarma de reversa' },
      { id: 'mu_seg_camara', label: 'Cámara (si tiene)' },
      { id: 'mu_seg_extintor', label: 'Extintor' },
      { id: 'mu_seg_triangulos', label: 'Triángulos' },
      { id: 'mu_seg_senal', label: 'Señalización' },
    ],
  },
  {
    titulo: '12 · Prueba operativa',
    items: [
      { id: 'mu_po_arranque', label: 'Arranque correcto' },
      { id: 'mu_po_mov', label: 'Movimientos suaves' },
      { id: 'mu_po_levante', label: 'Levanta y baja sin problema' },
      { id: 'mu_po_acople', label: 'Acople correcto con caja' },
    ],
  },
];

/** Orden plano para IDs y compatibilidad (2…4, luego 6…12; la sección 5 es la tabla de llantas). */
export const MULITA_SECCIONES: MulitaSeccionDef[] = [
  ...MULITA_SECCIONES_HASTA_LLANTAS,
  ...MULITA_SECCIONES_TRAS_LLANTAS,
];

const POS_LLANTAS_8 = ['D.I del.', 'D.I tras.', 'T.I del.', 'T.I tras.', 'D.D del.', 'D.D tras.', 'T.D del.', 'T.D tras.'];

function emptyLlantas8(): LlantaFila[] {
  return POS_LLANTAS_8.map((posicion) => ({
    posicion,
    marca: '',
    modelo: '',
    mm: '',
    sellos: '',
  }));
}

const POS_LLANTAS_MULITA_DEFAULT = [
  'Del. izq.',
  'Del. der.',
  'Tras. izq. ext.',
  'Tras. izq. int.',
  'Tras. der. int.',
  'Tras. der. ext.',
  'Aux. / repuesto',
  '—',
];

function emptyMulitaLlantas(): InspeccionMulita['llantas'] {
  return POS_LLANTAS_MULITA_DEFAULT.map((posicion) => ({
    posicion,
    estado: '',
    presion: '',
    danos: '',
  }));
}

function triRecord(ids: string[]): Record<string, Tri> {
  const o: Record<string, Tri> = {};
  for (const id of ids) o[id] = '';
  return o;
}

export function collectCajaSecaIds(): string[] {
  return CAJA_SECA_SECCIONES.flatMap((s) => s.items.map((i) => i.id));
}

export function collectMulitaIds(): string[] {
  return MULITA_SECCIONES.flatMap((s) => s.items.map((i) => i.id));
}

export function defaultInspeccionCompleta(): InspeccionCompleta {
  const prueba: Record<string, Tri> = {};
  for (const { id } of REFRIGERACION_PRUEBA_IDS) prueba[id] = '';
  const unidadFrigorifica: Record<string, Tri> = {};
  for (const { id } of REFRIGERACION_UNIDAD_FRIGO) unidadFrigorifica[id] = '';

  return {
    header: {
      folio: '',
      fechaInspeccion: '',
      conductor: '',
      nEconomico: '',
      hojaPlacas: '',
      hojaKm: '',
      hojaMarca: '',
      hojaTipo: '',
      camion: '',
      nivelCombustibleEscala: '',
      descripcionReparar: '',
      refacciones: '',
      mecanicoAsignado: '',
      firmaConformidad: '',
    },
    cajaSeca: {
      items: triRecord(collectCajaSecaIds()),
      llantas: emptyLlantas8(),
      danosNotas: '',
    },
    refrigeracion: {
      equipo: {
        marca: '',
        modelo: '',
        numeroSerie: '',
        horasMotor: '',
        tipoCombustible: '',
      },
      condiciones: {
        nivelDiesel: '',
        nivelAceite: '',
        nivelAnticongelante: '',
        estadoBateria: '',
        fugaAceite: '',
        fugaRefrigerante: '',
      },
      temperatura: {
        setPoint: '',
        tempActual: '',
        modoOperacion: '',
        lecturaDisplay: '',
        termografo: '',
        registroTemperatura: '',
      },
      prueba,
      unidadFrigorifica,
    },
    mulita: {
      datos: {
        operador: '',
        nEconomico: '',
        vinSerie: '',
        marca: '',
        modeloAnio: '',
        horasUso: '',
        ubicacion: '',
      },
      items: triRecord(collectMulitaIds()),
      llantas: emptyMulitaLlantas(),
    },
  };
}

/** Fusiona datos guardados con la plantilla actual (nuevos ítems aparecen vacíos). */
export function mergeInspeccionGuardada(raw: unknown): InspeccionCompleta {
  const base = defaultInspeccionCompleta();
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Partial<InspeccionCompleta>;
  return {
    header: { ...base.header, ...(o.header || {}) },
    cajaSeca: {
      items: { ...base.cajaSeca.items, ...(o.cajaSeca?.items || {}) },
      llantas:
        Array.isArray(o.cajaSeca?.llantas) && o.cajaSeca.llantas.length === base.cajaSeca.llantas.length
          ? o.cajaSeca.llantas.map((r, i) => ({ ...base.cajaSeca.llantas[i], ...r }))
          : base.cajaSeca.llantas,
      danosNotas: o.cajaSeca?.danosNotas ?? base.cajaSeca.danosNotas,
    },
    refrigeracion: {
      equipo: { ...base.refrigeracion.equipo, ...(o.refrigeracion?.equipo || {}) },
      condiciones: { ...base.refrigeracion.condiciones, ...(o.refrigeracion?.condiciones || {}) },
      temperatura: { ...base.refrigeracion.temperatura, ...(o.refrigeracion?.temperatura || {}) },
      prueba: { ...base.refrigeracion.prueba, ...(o.refrigeracion?.prueba || {}) },
      unidadFrigorifica: {
        ...base.refrigeracion.unidadFrigorifica,
        ...(o.refrigeracion?.unidadFrigorifica || {}),
      },
    },
    mulita: {
      datos: { ...base.mulita.datos, ...(o.mulita?.datos || {}) },
      items: { ...base.mulita.items, ...(o.mulita?.items || {}) },
      llantas:
        Array.isArray(o.mulita?.llantas) && o.mulita.llantas.length === base.mulita.llantas.length
          ? o.mulita.llantas.map((r, i) => ({ ...base.mulita.llantas[i], ...r }))
          : base.mulita.llantas,
    },
  };
}

export function defaultModalidadPorTipoUnidad(tipoUnidad?: string): ModalidadInspeccion {
  if (tipoUnidad === 'refrigerado') return 'refrigerado';
  if (tipoUnidad === 'maquinaria') return 'mulita_patio';
  return 'caja_seca';
}
