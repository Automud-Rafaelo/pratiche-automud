export const customerCopy = {
  brand: "Automud",
  actions: {
    continue: "Continua",
    start: "Iniziamo",
    back: "Indietro",
    understood: "Ho capito, continua",
    retry: "Riprova",
  },
  invalidLink: {
    title: "Questo link non è valido.",
    description: "Scrivici su WhatsApp.",
  },
  temporaryError: {
    title: "Qualcosa non ha funzionato.",
    description: "Riprova tra poco oppure scrivici su WhatsApp.",
  },
  placesAutocomplete: {
    addressLabel: "Indirizzo",
    addressPlaceholder: "Inizia a scrivere l’indirizzo",
    establishmentLabel: "Nome o indirizzo",
    establishmentPlaceholder: "Inizia a scrivere il nome o la via",
    loading: "Cerchiamo…",
    noResults: "Nessun risultato, prova a scrivere in modo diverso.",
    unavailable:
      "Non riusciamo a cercare in questo momento, scrivi l’indirizzo a mano.",
    manualLink: "Non la trovo, scrivo l’indirizzo a mano",
    manualLabel: "Indirizzo completo",
    manualPlaceholder: "Via, numero civico, città",
    confirmAddress: "Confermi questo indirizzo?",
    confirmEstablishment: "Confermi questo posto?",
    confirm: "Sì, è questo",
    change: "Cambia",
  },
  welcome: {
    title: "Ciao! Organizziamo insieme il passaggio della tua auto",
    description:
      "Ci servono i dati per il bonifico, la scelta dell’agenzia e le informazioni per il ritiro. Ci vogliono circa 3 minuti.",
    vehicle: "La tua auto",
    agreedPrice: "Prezzo concordato",
  },
  owner: {
    title: "L’auto è intestata a te?",
    description: "Ci aiuta a organizzare correttamente il passaggio.",
    yes: "Sì",
    no: "No",
  },
  ownerNotice: {
    title: "Il proprietario dovrà essere presente",
    description:
      "Dovrà venire in agenzia con un documento di identità valido.",
  },
  firstName: {
    title: "Come si chiama l’intestatario del conto?",
    description: "Il nome di chi riceverà il bonifico, come sull’IBAN.",
    ownerDescription: "Il conto deve essere intestato al proprietario dell’auto.",
    label: "Nome",
    placeholder: "Nome",
  },
  lastName: {
    title: "E il cognome?",
    description: "Sempre dell’intestatario del conto.",
    label: "Cognome",
    placeholder: "Cognome",
  },
  taxCode: {
    title: "Qual è il codice fiscale?",
    description: "Ci serve per preparare i documenti del passaggio.",
    label: "Codice fiscale",
    placeholder: "RSSMRA80A01H501U",
    error:
      "Controlla il codice fiscale: formato o carattere di controllo non corretti.",
  },
  iban: {
    title: "Su quale conto inviamo il bonifico?",
    description: "È il conto su cui riceverai il bonifico.",
    ownerDescription: "Deve essere intestato al proprietario dell’auto.",
    label: "IBAN",
    placeholder: "IT00 A000 0000 0000 0000 0000 000",
    error: "Controlla l’IBAN: sembra incompleto o non corretto.",
  },
  plate: {
    title: "È questa la targa dell’auto?",
    description: "Controllala prima di andare avanti.",
    confirm: "Sì, confermo",
    dispute: "No, non è questa",
  },
  customerPlate: {
    title: "Scrivi la targa che vedi sul libretto",
    description: "La segnaleremo al tuo referente e intanto andiamo avanti.",
    label: "Targa corretta",
    placeholder: "AA123AA",
    warning:
      "Questa targa ha un formato diverso da quello moderno: puoi continuare comunque.",
  },
  agencyLocation: {
    title: "Da quale posizione vuoi che troviamo un’agenzia?",
    description: "Ci serve per trovare l’agenzia più comoda per te.",
  },
  coownership: {
    title: "L’auto è intestata a più persone?",
    description: "Controlla il libretto se non ne sei sicuro.",
    yes: "Sì",
    no: "No",
  },
  coownershipNotice: {
    title: "Dovranno esserci tutti i proprietari",
    description:
      "Tutti i cointestatari dovranno essere presenti in agenzia con un documento.",
  },
  keys: {
    title: "Hai entrambe le chiavi dell’auto?",
    description: "Ci aiuta a organizzare il ritiro.",
    yes: "Sì",
    no: "No",
  },
  agency: {
    title: "Scegli l’agenzia dove fare il passaggio",
    description: "Ti mostriamo le opzioni più vicine alla posizione che hai indicato.",
    distance: "km",
    noChoice: "Non ti va bene nessuna? Scrivici su WhatsApp",
    outsideRadius:
      "Non abbiamo agenzie entro {radius} km da te. Queste sono le più vicine: se sono troppo lontane, scrivici su WhatsApp e ne cerchiamo una insieme.",
  },
  agencyFallback: {
    title: "Ti aiutiamo noi a scegliere l’agenzia",
    description:
      "Non riusciamo a trovare agenzie vicino a te, te ne proporremo una noi.",
  },
  ownerAvailability: {
    title: "Sai quando il proprietario può andare in agenzia?",
    description: "Se non lo sai, troviamo insieme il momento giusto.",
    yes: "Sì",
    no: "No",
  },
  availabilityNotice: {
    title: "Nessun problema",
    description:
      "Ti scriviamo su WhatsApp per trovare l’orario insieme.",
  },
  appointment: {
    title: "Quando preferiresti andare in agenzia?",
    description: "Ti confermeremo noi l’appuntamento.",
    morning: "Mattina",
    afternoon: "Pomeriggio",
  },
  pickupLocation: {
    title: "Dove si trova l’auto adesso?",
    description: "Così il carro attrezzi saprà dove raggiungerla.",
    home: "A casa",
    storage: "In un deposito",
    bodyShop: "In una carrozzeria",
  },
  pickupAddress: {
    home: {
      title: "Qual è l’indirizzo esatto?",
      description: "Scrivi la via e il numero civico.",
    },
    storage: {
      title: "Come si chiama il deposito?",
      description: "Scrivi il nome o la via, poi scegli dalla lista.",
    },
    bodyShop: {
      title: "Come si chiama la carrozzeria?",
      description: "Scrivi il nome o la via, poi scegli dalla lista.",
    },
  },
  pickupPhone: {
    title: "A quale numero può chiamarti il carro attrezzi?",
    description: "Lo useremo solo per organizzare il ritiro.",
    label: "Telefono",
    placeholder: "333 123 4567",
    error: "Inserisci un numero di telefono valido.",
  },
  complete: {
    title: "Fatto! Ecco cosa succede adesso",
    appointment: "Ti confermeremo l’appuntamento in agenzia.",
    preferredAppointment: "La tua preferenza è {date}, {slot}.",
    keys: "Lascia le chiavi nell’auto.",
    bothKeys: "Lascia entrambe le chiavi nell’auto.",
    businessPickup:
      "Non serve che tu sia presente, ma avvisa la struttura del ritiro.",
    towTruck: "Il carro attrezzi ti chiamerà al {phone} entro 24 ore.",
    selectedAgency: "Agenzia scelta",
    contact: "Per qualsiasi cosa scrivici su WhatsApp.",
  },
  progress: "{current} di {total}",
  dateLabels: {
    today: "Oggi",
    tomorrow: "Domani",
  },
} as const;
