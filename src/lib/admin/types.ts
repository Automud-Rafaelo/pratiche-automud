import type {
  AgencyImportStatus,
  AppointmentSlot,
  PracticeStatus,
  PracticeType,
} from "@/lib/config/business-rules";

export type PracticeRow = {
  id: string;
  token: string;
  created_at: string;
  updated_at: string;
  status: PracticeStatus;
  tipo_pratica: PracticeType;
  prezzo_concordato: number;
  targa: string;
  marca: string;
  modello: string;
  is_proprietario: boolean | null;
  nome: string | null;
  cognome: string | null;
  codice_fiscale: string | null;
  iban: string | null;
  cap: string | null;
  cointestata: boolean | null;
  due_chiavi: boolean | null;
  agenzia_id: string | null;
  preferenza_data: string | null;
  preferenza_fascia: AppointmentSlot | null;
  conosce_orari_proprietario: boolean | null;
  ubicazione_auto: "casa" | "deposito" | "carrozzeria" | null;
  indirizzo_ritiro: string | null;
  telefono_ritiro: string | null;
  check_intestatario_non_corrisponde: boolean | null;
  check_cdp_cartaceo: boolean | null;
  check_revisione_scaduta: boolean | null;
  check_km_scalati: boolean | null;
  check_fermo_amministrativo: boolean | null;
  appuntamento_confermato_data: string | null;
  appuntamento_confermato_fascia: AppointmentSlot | null;
  verifiche_completate_at: string | null;
  note_operatore: string | null;
};

export type AgencyRow = {
  id: string;
  nome: string;
  indirizzo: string;
  cap: string;
  comune: string;
  provincia: string;
  telefono: string | null;
  email: string | null;
  lat: number | null;
  lng: number | null;
  maps_url: string | null;
  google_place_id: string | null;
  orari: unknown | null;
  attiva: boolean;
  import_status: AgencyImportStatus;
  import_error: string | null;
  nome_normalizzato: string;
  cap_normalizzato: string;
};

export type EventRow = {
  id: string;
  pratica_id: string;
  created_at: string;
  tipo: string;
  dettaglio: Record<string, unknown>;
};
