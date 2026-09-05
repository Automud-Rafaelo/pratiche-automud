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
    title: "Come ti chiami?",
    description: "Inserisci il nome del proprietario dell’auto.",
    label: "Nome",
    placeholder: "Nome",
  },
  lastName: {
    title: "Qual è il tuo cognome?",
    description: "Inserisci il cognome del proprietario dell’auto.",
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
  postalCode: {
    title: "Qual è il tuo CAP?",
    description: "Ci serve per trovare l’agenzia più comoda per te.",
    label: "CAP",
    placeholder: "00000",
    error: "Inserisci un CAP di 5 cifre.",
    notFoundError: "Non troviamo questo CAP, controlla e riprova.",
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
    description: "Ti mostriamo le opzioni più vicine al CAP che hai indicato.",
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
    title: "Qual è l’indirizzo esatto?",
    descriptions: {
      home: "Scrivi la via e il numero civico.",
      business: "Scrivi il nome della struttura e l’indirizzo.",
    },
    label: "Indirizzo di ritiro",
    placeholder: "Via e numero civico",
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
