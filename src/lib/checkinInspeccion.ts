import { sugerenciaModalidadCheckin } from './tipoUnidadCatalogo';

/** Estados tipo hoja física: ✔ / X / N/A */
export type Tri = '' | 'ok' | 'mal' | 'na';

export type ModalidadInspeccion = 'caja_seca' | 'refrigerado' | 'mulita_patio' | 'plataforma' | 'dolly';

export const MODALIDAD_LABEL: Record<ModalidadInspeccion, string> = {
  caja_seca: 'Caja seca (remolque)',
  refrigerado: 'Refrigerado',
  mulita_patio: 'Mulita de patio',
  plataforma: 'Hoja de inspección – Plataforma',
  dolly: 'Hoja de inspección – Dolly',
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
 * Inspección operativa de unidad de refrigeración:
 * 1) Datos del equipo + condiciones + fugas; 2) Control de temperatura; 3) Prueba de funcionamiento;
 * 4) Carrocería del remolque (misma hoja SKYLINE · caja seca: ítems Tri, llantas, notas).
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
  /** Checklist de carrocería del remolque (mismos ítems que modalidad caja seca). */
  carroceriaRemolque: InspeccionCajaSeca;
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

/** Fila de llantas en hoja plataforma (No., posición, marca, medida, estado, sellos). */
export type PlataformaLlantaFila = {
  posicion: string;
  marca: string;
  medida: string;
  estado: string;
  sellos: string;
};

/** HOJA DE INSPECCIÓN – PLATAFORMA: marcar (X) zonas dañadas en carrocería. */
export const PLATAFORMA_DANOS_CARROCERIA: { id: string; label: string }[] = [
  { id: 'plt_dan_frente', label: 'Frente' },
  { id: 'plt_dan_tras', label: 'Parte trasera' },
  { id: 'plt_dan_lizq', label: 'Lado izquierdo' },
  { id: 'plt_dan_lder', label: 'Lado derecho' },
  { id: 'plt_dan_piso', label: 'Piso de plataforma' },
  { id: 'plt_dan_cuellos', label: 'Cuellos / estructura principal' },
  { id: 'plt_dan_laterales', label: 'Laterales / bordes' },
];

export type PlataformaRevisionKey =
  | 'estructura'
  | 'sistemaAmarre'
  | 'suspension'
  | 'frenos'
  | 'areaInferior'
  | 'chequeoRutina'
  | 'filtracionesDanos';

export const PLATAFORMA_SECCIONES_REVISION: {
  key: PlataformaRevisionKey;
  titulo: string;
  items: { id: string; label: string }[];
}[] = [
  {
    key: 'estructura',
    titulo: 'Estructura',
    items: [
      { id: 'plt_est_largueros', label: 'Largueros' },
      { id: 'plt_est_travies', label: 'Travesaños' },
      { id: 'plt_est_cuello', label: 'Cuello de ganso' },
      { id: 'plt_est_piso', label: 'Piso (madera / acero)' },
      { id: 'plt_est_bordes', label: 'Bordes laterales' },
      { id: 'plt_est_soldaduras', label: 'Soldaduras' },
    ],
  },
  {
    key: 'sistemaAmarre',
    titulo: 'Sistema de amarre',
    items: [
      { id: 'plt_am_winches', label: 'Winches' },
      { id: 'plt_am_cintas', label: 'Cintas' },
      { id: 'plt_am_matracas', label: 'Matracas' },
      { id: 'plt_am_ganchos', label: 'Ganchos' },
      { id: 'plt_am_anillos', label: 'Anillos «D»' },
    ],
  },
  {
    key: 'suspension',
    titulo: 'Suspensión',
    items: [
      { id: 'plt_sus_muelles', label: 'Muelles / bolsas de aire' },
      { id: 'plt_sus_amort', label: 'Amortiguadores' },
      { id: 'plt_sus_ejes', label: 'Ejes' },
      { id: 'plt_sus_abs', label: 'Sistema ABS' },
      { id: 'plt_sus_mangueras', label: 'Mangueras de aire' },
    ],
  },
  {
    key: 'frenos',
    titulo: 'Sistema de frenos',
    items: [
      { id: 'plt_fr_balatas', label: 'Balatas' },
      { id: 'plt_fr_tambores', label: 'Tambores / discos' },
      { id: 'plt_fr_lineas', label: 'Líneas de aire' },
      { id: 'plt_fr_valvulas', label: 'Válvulas' },
    ],
  },
  {
    key: 'areaInferior',
    titulo: 'Área inferior',
    items: [
      { id: 'plt_inf_patines', label: 'Patines' },
      { id: 'plt_inf_manivelas', label: 'Manivelas' },
      { id: 'plt_inf_pernos', label: 'Pernos rey' },
      { id: 'plt_inf_soportes', label: 'Soportes' },
      { id: 'plt_inf_base', label: 'Base estructural' },
    ],
  },
  {
    key: 'chequeoRutina',
    titulo: 'Chequeo de rutina importante',
    items: [
      { id: 'plt_rut_luces_tras', label: 'Luces traseras' },
      { id: 'plt_rut_luces_lat', label: 'Luces laterales' },
      { id: 'plt_rut_luces_freno', label: 'Luces de freno' },
      { id: 'plt_rut_refl', label: 'Reflejantes' },
      { id: 'plt_rut_placa', label: 'Placa' },
      { id: 'plt_rut_porta', label: 'Porta placa' },
      { id: 'plt_rut_topes', label: 'Topes' },
      { id: 'plt_rut_conexion', label: 'Conexiones eléctricas' },
      { id: 'plt_rut_mangueras', label: 'Mangueras de aire' },
    ],
  },
  {
    key: 'filtracionesDanos',
    titulo: 'Condiciones generales — filtraciones / daños',
    items: [
      { id: 'plt_fil_piso', label: 'Piso' },
      { id: 'plt_fil_estructura', label: 'Estructura' },
      { id: 'plt_fil_soldaduras', label: 'Soldaduras' },
    ],
  },
];

export type InspeccionPlataforma = {
  danosCarroceria: Record<string, Tri>;
  estructura: Record<string, Tri>;
  sistemaAmarre: Record<string, Tri>;
  suspension: Record<string, Tri>;
  frenos: Record<string, Tri>;
  areaInferior: Record<string, Tri>;
  chequeoRutina: Record<string, Tri>;
  filtracionesDanos: Record<string, Tri>;
  llantas: PlataformaLlantaFila[];
  descripcionDanos: string;
  observacionesGenerales: string;
};

function emptyPlataformaLlantas(): PlataformaLlantaFila[] {
  return Array.from({ length: 8 }, () => ({
    posicion: '',
    marca: '',
    medida: '',
    estado: '',
    sellos: '',
  }));
}

function defaultPlataformaInspeccion(): InspeccionPlataforma {
  const danosCarroceria = triRecord(PLATAFORMA_DANOS_CARROCERIA.map((x) => x.id));
  const secciones: Pick<
    InspeccionPlataforma,
    | 'estructura'
    | 'sistemaAmarre'
    | 'suspension'
    | 'frenos'
    | 'areaInferior'
    | 'chequeoRutina'
    | 'filtracionesDanos'
  > = {
    estructura: {},
    sistemaAmarre: {},
    suspension: {},
    frenos: {},
    areaInferior: {},
    chequeoRutina: {},
    filtracionesDanos: {},
  };
  for (const sec of PLATAFORMA_SECCIONES_REVISION) {
    const bucket = secciones[sec.key] as Record<string, Tri>;
    for (const it of sec.items) bucket[it.id] = '';
  }
  return {
    danosCarroceria,
    ...secciones,
    llantas: emptyPlataformaLlantas(),
    descripcionDanos: '',
    observacionesGenerales: '',
  };
}

/** HOJA DE INSPECCIÓN – DOLLY: marcar (X) partes dañadas (daños generales). */
export const DOLLY_DANOS_GENERALES: { id: string; label: string }[] = [
  { id: 'dly_dan_estructura', label: 'Estructura principal' },
  { id: 'dly_dan_lanza', label: 'Lanza / barra de tiro' },
  { id: 'dly_dan_quinta', label: 'Quinta rueda' },
  { id: 'dly_dan_base', label: 'Base del dolly' },
  { id: 'dly_dan_soportes', label: 'Soportes' },
  { id: 'dly_dan_guardafangos', label: 'Guardafangos' },
];

export type DollyRevisionKey =
  | 'estructura'
  | 'sistemaAcople'
  | 'suspension'
  | 'frenos'
  | 'areaInferior'
  | 'chequeoRutina'
  | 'condicionesGenerales';

export const DOLLY_SECCIONES_REVISION: {
  key: DollyRevisionKey;
  titulo: string;
  items: { id: string; label: string }[];
}[] = [
  {
    key: 'estructura',
    titulo: 'Estructura',
    items: [
      { id: 'dly_est_bastidor', label: 'Bastidor' },
      { id: 'dly_est_largueros', label: 'Largueros' },
      { id: 'dly_est_travies', label: 'Travesaños' },
      { id: 'dly_est_soldaduras', label: 'Soldaduras' },
      { id: 'dly_est_soportes', label: 'Soportes' },
    ],
  },
  {
    key: 'sistemaAcople',
    titulo: 'Sistema de acople',
    items: [
      { id: 'dly_ac_lanza', label: 'Lanza (barra de tiro)' },
      { id: 'dly_ac_ojo', label: 'Ojo de enganche' },
      { id: 'dly_ac_quinta', label: 'Quinta rueda' },
      { id: 'dly_ac_seguro', label: 'Seguro de quinta rueda' },
      { id: 'dly_ac_perno', label: 'Perno rey' },
    ],
  },
  {
    key: 'suspension',
    titulo: 'Suspensión',
    items: [
      { id: 'dly_sus_muelles', label: 'Muelles / bolsas de aire' },
      { id: 'dly_sus_amort', label: 'Amortiguadores' },
      { id: 'dly_sus_ejes', label: 'Ejes' },
      { id: 'dly_sus_abs', label: 'Sistema ABS' },
      { id: 'dly_sus_mangueras', label: 'Mangueras' },
    ],
  },
  {
    key: 'frenos',
    titulo: 'Sistema de frenos',
    items: [
      { id: 'dly_fr_balatas', label: 'Balatas' },
      { id: 'dly_fr_tambores', label: 'Tambores / discos' },
      { id: 'dly_fr_lineas', label: 'Líneas de aire' },
      { id: 'dly_fr_valvulas', label: 'Válvulas' },
    ],
  },
  {
    key: 'areaInferior',
    titulo: 'Área inferior',
    items: [
      { id: 'dly_inf_patines', label: 'Patines (si aplica)' },
      { id: 'dly_inf_base', label: 'Base estructural' },
      { id: 'dly_inf_soportes', label: 'Soportes' },
      { id: 'dly_inf_pernos', label: 'Pernos' },
      { id: 'dly_inf_conexiones', label: 'Conexiones' },
    ],
  },
  {
    key: 'chequeoRutina',
    titulo: 'Chequeo de rutina importante',
    items: [
      { id: 'dly_rut_luces_tras', label: 'Luces traseras' },
      { id: 'dly_rut_luces_lat', label: 'Luces laterales' },
      { id: 'dly_rut_luces_freno', label: 'Luces de freno' },
      { id: 'dly_rut_refl', label: 'Reflejantes' },
      { id: 'dly_rut_placa', label: 'Placa' },
      { id: 'dly_rut_porta', label: 'Porta placa' },
      { id: 'dly_rut_conexion', label: 'Conexiones eléctricas' },
      { id: 'dly_rut_mangueras', label: 'Mangueras de aire' },
      { id: 'dly_rut_cables', label: 'Cables de seguridad' },
    ],
  },
  {
    key: 'condicionesGenerales',
    titulo: 'Condiciones generales — revisión de daños o fallas',
    items: [
      { id: 'dly_cond_estructura', label: 'Estructura' },
      { id: 'dly_cond_quinta', label: 'Quinta rueda' },
      { id: 'dly_cond_lanza', label: 'Lanza' },
      { id: 'dly_cond_frenos', label: 'Sistema de frenos' },
    ],
  },
];

export type InspeccionDolly = {
  danosGenerales: Record<string, Tri>;
  estructura: Record<string, Tri>;
  sistemaAcople: Record<string, Tri>;
  suspension: Record<string, Tri>;
  frenos: Record<string, Tri>;
  areaInferior: Record<string, Tri>;
  chequeoRutina: Record<string, Tri>;
  condicionesGenerales: Record<string, Tri>;
  llantas: PlataformaLlantaFila[];
  descripcionDanos: string;
  observacionesGenerales: string;
};

function emptyDollyLlantas(): PlataformaLlantaFila[] {
  return Array.from({ length: 4 }, () => ({
    posicion: '',
    marca: '',
    medida: '',
    estado: '',
    sellos: '',
  }));
}

function defaultDollyInspeccion(): InspeccionDolly {
  const danosGenerales = triRecord(DOLLY_DANOS_GENERALES.map((x) => x.id));
  const secciones: Pick<
    InspeccionDolly,
    | 'estructura'
    | 'sistemaAcople'
    | 'suspension'
    | 'frenos'
    | 'areaInferior'
    | 'chequeoRutina'
    | 'condicionesGenerales'
  > = {
    estructura: {},
    sistemaAcople: {},
    suspension: {},
    frenos: {},
    areaInferior: {},
    chequeoRutina: {},
    condicionesGenerales: {},
  };
  for (const sec of DOLLY_SECCIONES_REVISION) {
    const bucket = secciones[sec.key] as Record<string, Tri>;
    for (const it of sec.items) bucket[it.id] = '';
  }
  return {
    danosGenerales,
    ...secciones,
    llantas: emptyDollyLlantas(),
    descripcionDanos: '',
    observacionesGenerales: '',
  };
}

export type InspeccionCompleta = {
  header: InspeccionHeader;
  cajaSeca: InspeccionCajaSeca;
  refrigeracion: InspeccionRefrigeracion;
  mulita: InspeccionMulita;
  plataforma: InspeccionPlataforma;
  dolly: InspeccionDolly;
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
      carroceriaRemolque: {
        items: triRecord(collectCajaSecaIds()),
        llantas: emptyLlantas8(),
        danosNotas: '',
      },
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
    plataforma: defaultPlataformaInspeccion(),
    dolly: defaultDollyInspeccion(),
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
      carroceriaRemolque: (() => {
        const cr = o.refrigeracion?.carroceriaRemolque;
        const baseCr = base.refrigeracion.carroceriaRemolque;
        return {
          items: { ...baseCr.items, ...(cr?.items || {}) },
          llantas:
            Array.isArray(cr?.llantas) && cr.llantas.length === baseCr.llantas.length
              ? cr.llantas.map((r, i) => ({ ...baseCr.llantas[i], ...r }))
              : baseCr.llantas,
          danosNotas: cr?.danosNotas ?? baseCr.danosNotas,
        };
      })(),
    },
    mulita: {
      datos: { ...base.mulita.datos, ...(o.mulita?.datos || {}) },
      items: { ...base.mulita.items, ...(o.mulita?.items || {}) },
      llantas:
        Array.isArray(o.mulita?.llantas) && o.mulita.llantas.length === base.mulita.llantas.length
          ? o.mulita.llantas.map((r, i) => ({ ...base.mulita.llantas[i], ...r }))
          : base.mulita.llantas,
    },
    plataforma: (() => {
      const bp = base.plataforma;
      const op = o.plataforma;
      if (!op || typeof op !== 'object') return bp;
      const p = op as Partial<InspeccionPlataforma>;
      return {
        danosCarroceria: { ...bp.danosCarroceria, ...(p.danosCarroceria || {}) },
        estructura: { ...bp.estructura, ...(p.estructura || {}) },
        sistemaAmarre: { ...bp.sistemaAmarre, ...(p.sistemaAmarre || {}) },
        suspension: { ...bp.suspension, ...(p.suspension || {}) },
        frenos: { ...bp.frenos, ...(p.frenos || {}) },
        areaInferior: { ...bp.areaInferior, ...(p.areaInferior || {}) },
        chequeoRutina: { ...bp.chequeoRutina, ...(p.chequeoRutina || {}) },
        filtracionesDanos: { ...bp.filtracionesDanos, ...(p.filtracionesDanos || {}) },
        llantas:
          Array.isArray(p.llantas) && p.llantas.length === bp.llantas.length
            ? p.llantas.map((r, i) => ({ ...bp.llantas[i], ...r }))
            : bp.llantas,
        descripcionDanos: p.descripcionDanos ?? bp.descripcionDanos,
        observacionesGenerales: p.observacionesGenerales ?? bp.observacionesGenerales,
      };
    })(),
    dolly: (() => {
      const bd = base.dolly;
      const od = o.dolly;
      if (!od || typeof od !== 'object') return bd;
      const d = od as Partial<InspeccionDolly>;
      return {
        danosGenerales: { ...bd.danosGenerales, ...(d.danosGenerales || {}) },
        estructura: { ...bd.estructura, ...(d.estructura || {}) },
        sistemaAcople: { ...bd.sistemaAcople, ...(d.sistemaAcople || {}) },
        suspension: { ...bd.suspension, ...(d.suspension || {}) },
        frenos: { ...bd.frenos, ...(d.frenos || {}) },
        areaInferior: { ...bd.areaInferior, ...(d.areaInferior || {}) },
        chequeoRutina: { ...bd.chequeoRutina, ...(d.chequeoRutina || {}) },
        condicionesGenerales: { ...bd.condicionesGenerales, ...(d.condicionesGenerales || {}) },
        llantas:
          Array.isArray(d.llantas) && d.llantas.length === bd.llantas.length
            ? d.llantas.map((r, i) => ({ ...bd.llantas[i], ...r }))
            : bd.llantas,
        descripcionDanos: d.descripcionDanos ?? bd.descripcionDanos,
        observacionesGenerales: d.observacionesGenerales ?? bd.observacionesGenerales,
      };
    })(),
  };
}

export function defaultModalidadPorTipoUnidad(tipoUnidad?: string): ModalidadInspeccion {
  return sugerenciaModalidadCheckin(tipoUnidad);
}
