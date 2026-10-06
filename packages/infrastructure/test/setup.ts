// IndexedDB não existe em Node. `fake-indexeddb` instala uma implementação
// em memória, permitindo testar o outbox — que é o componente onde um erro
// custa uma presença confirmada pelo professor.
import 'fake-indexeddb/auto';
