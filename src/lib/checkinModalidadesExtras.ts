/** Mismo contrato que `Tri` en checkinInspeccion (evita import circular). */
export type TriAux = '' | 'ok' | 'mal' | 'na';

export type LlantaInspeccionStd = {
  posicion: string;
  marca: string;
  medida: string;
  estado: string;
  sellos: string;
};

/** ─── Caja refrigerada (sin termo) ─── */
export const CAJA_REF_ST_DANOS_CARROCERIA: { id: string; label: string }[] = [
  { id: 'crst_dan_frente', label: 'Frente' },
  { id: 'crst_dan_tras', label: 'Parte trasera' },
  { id: 'crst_dan_lizq', label: 'Lado izquierdo' },
  { id: 'crst_dan_lder', label: 'Lado derecho' },
  { id: 'crst_dan_techo', label: 'Techo' },
  { id: 'crst_dan_piso', label: 'Piso' },
  { id: 'crst_dan_puertas', label: 'Puertas' },
];

export type CajaRefSinTermoRevisionKey =
  | 'paredFrontal'
  | 'paredLatDer'
  | 'paredLatIzq'
  | 'areaTrasera'
  | 'areaInterior'
  | 'areaInferior'
  | 'suspension'
  | 'chequeoRutina'
  | 'filtraciones'
  | 'aislamiento';

export const CAJA_REF_ST_SECCIONES: {
  key: CajaRefSinTermoRevisionKey;
  titulo: string;
  items: { id: string; label: string }[];
}[] = [
  {
    key: 'paredFrontal',
    titulo: 'Pared frontal',
    items: [
      { id: 'crst_pf_panel', label: 'Panel' },
      { id: 'crst_pf_aisl', label: 'Aislamiento' },
      { id: 'crst_pf_rem', label: 'Remaches' },
      { id: 'crst_pf_sellos', label: 'Sellos' },
      { id: 'crst_pf_esq', label: 'Esquinas' },
    ],
  },
  {
    key: 'paredLatDer',
    titulo: 'Pared lateral derecha',
    items: [
      { id: 'crst_pld_panel', label: 'Panel' },
      { id: 'crst_pld_aisl', label: 'Aislamiento' },
      { id: 'crst_pld_rem', label: 'Remaches' },
      { id: 'crst_pld_bsup', label: 'Borda superior' },
      { id: 'crst_pld_binf', label: 'Borda inferior' },
    ],
  },
  {
    key: 'paredLatIzq',
    titulo: 'Pared lateral izquierda',
    items: [
      { id: 'crst_pli_panel', label: 'Panel' },
      { id: 'crst_pli_aisl', label: 'Aislamiento' },
      { id: 'crst_pli_rem', label: 'Remaches' },
      { id: 'crst_pli_bsup', label: 'Borda superior' },
      { id: 'crst_pli_binf', label: 'Borda inferior' },
    ],
  },
  {
    key: 'areaTrasera',
    titulo: 'Área trasera',
    items: [
      { id: 'crst_at_puertas', label: 'Puertas' },
      { id: 'crst_at_bisagras', label: 'Bisagras' },
      { id: 'crst_at_chapas', label: 'Chapas / cerraduras' },
      { id: 'crst_at_emp', label: 'Empaques (hules)' },
      { id: 'crst_at_cierres', label: 'Cierres' },
      { id: 'crst_at_topes', label: 'Topes' },
    ],
  },
  {
    key: 'areaInterior',
    titulo: 'Área interior',
    items: [
      { id: 'crst_ai_pf', label: 'Pared frontal' },
      { id: 'crst_ai_pd', label: 'Pared derecha' },
      { id: 'crst_ai_pi', label: 'Pared izquierda' },
      { id: 'crst_ai_techo', label: 'Techo (interior)' },
      { id: 'crst_ai_piso', label: 'Piso (antiderrapante)' },
      { id: 'crst_ai_canal', label: 'Canaletas' },
    ],
  },
  {
    key: 'areaInferior',
    titulo: 'Área inferior',
    items: [
      { id: 'crst_inf_chasis', label: 'Chasis' },
      { id: 'crst_inf_trav', label: 'Travesaños' },
      { id: 'crst_inf_sop', label: 'Soportes' },
      { id: 'crst_inf_pat', label: 'Patines' },
      { id: 'crst_inf_man', label: 'Manivelas' },
      { id: 'crst_inf_perno', label: 'Perno rey' },
    ],
  },
  {
    key: 'suspension',
    titulo: 'Suspensión',
    items: [
      { id: 'crst_sus_bal', label: 'Balatas' },
      { id: 'crst_sus_tamb', label: 'Tambores' },
      { id: 'crst_sus_bolsas', label: 'Bolsas de aire' },
      { id: 'crst_sus_amort', label: 'Amortiguadores' },
      { id: 'crst_sus_abs', label: 'Sistema ABS' },
      { id: 'crst_sus_ret', label: 'Retenes' },
    ],
  },
  {
    key: 'chequeoRutina',
    titulo: 'Chequeo de rutina importante',
    items: [
      { id: 'crst_rut_ltras', label: 'Luces traseras' },
      { id: 'crst_rut_llat', label: 'Luces laterales' },
      { id: 'crst_rut_lsup', label: 'Luces superiores' },
      { id: 'crst_rut_lfre', label: 'Luces de freno' },
      { id: 'crst_rut_refl', label: 'Reflejantes' },
      { id: 'crst_rut_placa', label: 'Placa' },
      { id: 'crst_rut_porta', label: 'Porta placa' },
      { id: 'crst_rut_topes', label: 'Topes' },
      { id: 'crst_rut_conex', label: 'Conexiones' },
    ],
  },
  {
    key: 'filtraciones',
    titulo: 'Filtraciones (muy importante en refrigerada)',
    items: [
      { id: 'crst_fil_techo', label: 'Techo' },
      { id: 'crst_fil_paredes', label: 'Paredes' },
      { id: 'crst_fil_piso', label: 'Piso' },
      { id: 'crst_fil_puertas', label: 'Puertas (empaques)' },
    ],
  },
  {
    key: 'aislamiento',
    titulo: 'Aislamiento',
    items: [
      { id: 'crst_ais_gen', label: 'Estado general del aislamiento' },
      { id: 'crst_ais_golpes', label: 'Golpes que comprometan temperatura' },
      { id: 'crst_ais_hum', label: 'Humedad interna' },
    ],
  },
];

export type InspeccionCajaRefSinTermo = {
  danosCarroceria: Record<string, TriAux>;
  paredFrontal: Record<string, TriAux>;
  paredLatDer: Record<string, TriAux>;
  paredLatIzq: Record<string, TriAux>;
  areaTrasera: Record<string, TriAux>;
  areaInterior: Record<string, TriAux>;
  areaInferior: Record<string, TriAux>;
  suspension: Record<string, TriAux>;
  chequeoRutina: Record<string, TriAux>;
  filtraciones: Record<string, TriAux>;
  aislamiento: Record<string, TriAux>;
  llantas: LlantaInspeccionStd[];
  descripcionDanos: string;
  observacionesGenerales: string;
};

/** ─── Pickup ─── */
export const PICKUP_DANOS_CARROCERIA: { id: string; label: string }[] = [
  { id: 'pkp_dan_defd', label: 'Defensa delantera' },
  { id: 'pkp_dan_deft', label: 'Defensa trasera' },
  { id: 'pkp_dan_cofre', label: 'Cofre' },
  { id: 'pkp_dan_puertas', label: 'Puertas' },
  { id: 'pkp_dan_lizq', label: 'Lado izquierdo' },
  { id: 'pkp_dan_lder', label: 'Lado derecho' },
  { id: 'pkp_dan_caja', label: 'Caja / batea' },
  { id: 'pkp_dan_comp', label: 'Compuerta trasera' },
  { id: 'pkp_dan_techo', label: 'Techo' },
  { id: 'pkp_dan_parab', label: 'Parabrisas' },
  { id: 'pkp_dan_esp', label: 'Espejos' },
];

export type PickupRevisionKey =
  | 'motor'
  | 'frenos'
  | 'suspension'
  | 'transmision'
  | 'chequeoRutina'
  | 'interior'
  | 'cajaBatea'
  | 'condicionesGenerales';

export const PICKUP_SECCIONES: {
  key: PickupRevisionKey;
  titulo: string;
  items: { id: string; label: string }[];
}[] = [
  {
    key: 'motor',
    titulo: 'Motor',
    items: [
      { id: 'pkp_mot_aceite', label: 'Nivel de aceite' },
      { id: 'pkp_mot_fuga', label: 'Fugas de aceite' },
      { id: 'pkp_mot_anti', label: 'Anticongelante' },
      { id: 'pkp_mot_bandas', label: 'Bandas' },
      { id: 'pkp_mot_bat', label: 'Batería' },
      { id: 'pkp_mot_filt', label: 'Filtros' },
      { id: 'pkp_mot_elec', label: 'Sistema eléctrico' },
    ],
  },
  {
    key: 'frenos',
    titulo: 'Sistema de frenos',
    items: [
      { id: 'pkp_fr_bal', label: 'Balatas' },
      { id: 'pkp_fr_disc', label: 'Discos' },
      { id: 'pkp_fr_liq', label: 'Líquido de frenos' },
      { id: 'pkp_fr_lin', label: 'Líneas' },
    ],
  },
  {
    key: 'suspension',
    titulo: 'Suspensión',
    items: [
      { id: 'pkp_sus_amort', label: 'Amortiguadores' },
      { id: 'pkp_sus_muelles', label: 'Muelles' },
      { id: 'pkp_sus_dir', label: 'Dirección' },
      { id: 'pkp_sus_ejes', label: 'Ejes' },
    ],
  },
  {
    key: 'transmision',
    titulo: 'Transmisión',
    items: [
      { id: 'pkp_tr_caja', label: 'Caja (manual/automática)' },
      { id: 'pkp_tr_emb', label: 'Embrague (si aplica)' },
      { id: 'pkp_tr_dif', label: 'Diferencial' },
      { id: 'pkp_tr_flechas', label: 'Flechas' },
    ],
  },
  {
    key: 'chequeoRutina',
    titulo: 'Chequeo de rutina importante',
    items: [
      { id: 'pkp_rut_ldel', label: 'Luces delanteras' },
      { id: 'pkp_rut_ltras', label: 'Luces traseras' },
      { id: 'pkp_rut_dir', label: 'Direccionales' },
      { id: 'pkp_rut_freno', label: 'Luces de freno' },
      { id: 'pkp_rut_rev', label: 'Luces de reversa' },
      { id: 'pkp_rut_niebla', label: 'Faros de niebla (si aplica)' },
      { id: 'pkp_rut_clax', label: 'Claxon' },
      { id: 'pkp_rut_limp', label: 'Limpiaparabrisas' },
    ],
  },
  {
    key: 'interior',
    titulo: 'Interior',
    items: [
      { id: 'pkp_in_asie', label: 'Asientos' },
      { id: 'pkp_in_cint', label: 'Cinturones de seguridad' },
      { id: 'pkp_in_tab', label: 'Tablero' },
      { id: 'pkp_in_ind', label: 'Indicadores (check engine, etc.)' },
      { id: 'pkp_in_ac', label: 'Aire acondicionado / calefacción' },
      { id: 'pkp_in_radio', label: 'Radio / controles' },
      { id: 'pkp_in_vid', label: 'Vidrios eléctricos' },
      { id: 'pkp_in_seg', label: 'Seguros' },
    ],
  },
  {
    key: 'cajaBatea',
    titulo: 'Caja / batea',
    items: [
      { id: 'pkp_cb_piso', label: 'Piso' },
      { id: 'pkp_cb_lat', label: 'Laterales' },
      { id: 'pkp_cb_comp', label: 'Compuerta trasera' },
      { id: 'pkp_cb_liner', label: 'Protección (liner)' },
      { id: 'pkp_cb_gan', label: 'Ganchos de amarre' },
    ],
  },
  {
    key: 'condicionesGenerales',
    titulo: 'Condiciones generales — revisión de',
    items: [
      { id: 'pkp_cond_fugas', label: 'Fugas (aceite / anticongelante)' },
      { id: 'pkp_cond_ruidos', label: 'Ruidos anormales' },
      { id: 'pkp_cond_vib', label: 'Vibraciones' },
    ],
  },
];

export type InspeccionPickup = {
  danosCarroceria: Record<string, TriAux>;
  motor: Record<string, TriAux>;
  frenos: Record<string, TriAux>;
  suspension: Record<string, TriAux>;
  transmision: Record<string, TriAux>;
  chequeoRutina: Record<string, TriAux>;
  interior: Record<string, TriAux>;
  cajaBatea: Record<string, TriAux>;
  condicionesGenerales: Record<string, TriAux>;
  llantas: LlantaInspeccionStd[];
  descripcionDanos: string;
  observacionesGenerales: string;
};

/** ─── Vehículo empresarial ─── */
export const VEH_EMP_DANOS_CARROCERIA: { id: string; label: string }[] = [
  { id: 'vem_dan_defd', label: 'Defensa delantera' },
  { id: 'vem_dan_deft', label: 'Defensa trasera' },
  { id: 'vem_dan_cofre', label: 'Cofre' },
  { id: 'vem_dan_cajuela', label: 'Cajuela' },
  { id: 'vem_dan_puertas', label: 'Puertas' },
  { id: 'vem_dan_lizq', label: 'Lado izquierdo' },
  { id: 'vem_dan_lder', label: 'Lado derecho' },
  { id: 'vem_dan_techo', label: 'Techo' },
  { id: 'vem_dan_parab', label: 'Parabrisas' },
  { id: 'vem_dan_vidrios', label: 'Vidrios' },
  { id: 'vem_dan_esp', label: 'Espejos' },
];

export type VehiculoEmpresarialRevisionKey =
  | 'motor'
  | 'frenos'
  | 'suspension'
  | 'transmision'
  | 'chequeoRutina'
  | 'interior'
  | 'cajuela'
  | 'condicionesGenerales'
  | 'documentacion';

export const VEH_EMP_SECCIONES: {
  key: VehiculoEmpresarialRevisionKey;
  titulo: string;
  items: { id: string; label: string }[];
}[] = [
  {
    key: 'motor',
    titulo: 'Motor',
    items: [
      { id: 'vem_mot_aceite', label: 'Nivel de aceite' },
      { id: 'vem_mot_fuga', label: 'Fugas de aceite' },
      { id: 'vem_mot_anti', label: 'Anticongelante' },
      { id: 'vem_mot_limp', label: 'Líquido limpiaparabrisas' },
      { id: 'vem_mot_bandas', label: 'Bandas' },
      { id: 'vem_mot_bat', label: 'Batería' },
      { id: 'vem_mot_elec', label: 'Sistema eléctrico' },
    ],
  },
  {
    key: 'frenos',
    titulo: 'Sistema de frenos',
    items: [
      { id: 'vem_fr_bal', label: 'Balatas' },
      { id: 'vem_fr_disc', label: 'Discos' },
      { id: 'vem_fr_liq', label: 'Líquido de frenos' },
      { id: 'vem_fr_lin', label: 'Líneas' },
    ],
  },
  {
    key: 'suspension',
    titulo: 'Suspensión',
    items: [
      { id: 'vem_sus_amort', label: 'Amortiguadores' },
      { id: 'vem_sus_dir', label: 'Dirección' },
      { id: 'vem_sus_ejes', label: 'Ejes' },
      { id: 'vem_sus_term', label: 'Terminales' },
    ],
  },
  {
    key: 'transmision',
    titulo: 'Transmisión',
    items: [
      { id: 'vem_tr_caja', label: 'Caja (manual/automática)' },
      { id: 'vem_tr_emb', label: 'Embrague (si aplica)' },
      { id: 'vem_tr_dif', label: 'Diferencial' },
    ],
  },
  {
    key: 'chequeoRutina',
    titulo: 'Chequeo de rutina importante',
    items: [
      { id: 'vem_rut_ldel', label: 'Luces delanteras' },
      { id: 'vem_rut_ltras', label: 'Luces traseras' },
      { id: 'vem_rut_dir', label: 'Direccionales' },
      { id: 'vem_rut_freno', label: 'Luces de freno' },
      { id: 'vem_rut_rev', label: 'Luces de reversa' },
      { id: 'vem_rut_niebla', label: 'Faros de niebla (si aplica)' },
      { id: 'vem_rut_clax', label: 'Claxon' },
      { id: 'vem_rut_limp', label: 'Limpiaparabrisas' },
    ],
  },
  {
    key: 'interior',
    titulo: 'Interior',
    items: [
      { id: 'vem_in_asie', label: 'Asientos' },
      { id: 'vem_in_cint', label: 'Cinturones de seguridad' },
      { id: 'vem_in_tab', label: 'Tablero' },
      { id: 'vem_in_ind', label: 'Indicadores (testigos)' },
      { id: 'vem_in_ac', label: 'Aire acondicionado' },
      { id: 'vem_in_radio', label: 'Radio / controles' },
      { id: 'vem_in_vid', label: 'Vidrios eléctricos' },
      { id: 'vem_in_seg', label: 'Seguros' },
      { id: 'vem_in_tap', label: 'Tapicería' },
    ],
  },
  {
    key: 'cajuela',
    titulo: 'Cajuela',
    items: [
      { id: 'vem_caj_piso', label: 'Piso' },
      { id: 'vem_caj_herr', label: 'Herramienta' },
      { id: 'vem_caj_gato', label: 'Gato' },
      { id: 'vem_caj_llanta', label: 'Llanta de refacción' },
      { id: 'vem_caj_tri', label: 'Triángulos / señalización' },
    ],
  },
  {
    key: 'condicionesGenerales',
    titulo: 'Condiciones generales — revisión de',
    items: [
      { id: 'vem_cond_fugas', label: 'Fugas (aceite / anticongelante)' },
      { id: 'vem_cond_ruidos', label: 'Ruidos anormales' },
      { id: 'vem_cond_vib', label: 'Vibraciones' },
    ],
  },
  {
    key: 'documentacion',
    titulo: 'Documentación',
    items: [
      { id: 'vem_doc_circ', label: 'Tarjeta de circulación' },
      { id: 'vem_doc_seguro', label: 'Póliza de seguro' },
      { id: 'vem_doc_verif', label: 'Verificación (si aplica)' },
    ],
  },
];

export type InspeccionVehiculoEmpresarial = {
  danosCarroceria: Record<string, TriAux>;
  motor: Record<string, TriAux>;
  frenos: Record<string, TriAux>;
  suspension: Record<string, TriAux>;
  transmision: Record<string, TriAux>;
  chequeoRutina: Record<string, TriAux>;
  interior: Record<string, TriAux>;
  cajuela: Record<string, TriAux>;
  condicionesGenerales: Record<string, TriAux>;
  documentacion: Record<string, TriAux>;
  llantas: LlantaInspeccionStd[];
  descripcionDanos: string;
  observacionesGenerales: string;
};

export const POS_LLANTAS_PICKUP_VEH: string[] = ['Del. Izq.', 'Del. Der.', 'Tras. Izq.', 'Tras. Der.', 'Refacción'];
