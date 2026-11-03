import { useCallback, useEffect, useRef, useState } from 'react';
import { mensagemDeErro } from '@/lib/localizacao';

/**
 * A posição do visitante, enquanto ele se desloca.
 *
 * Usa `watchPosition` e não `getCurrentPosition`: com uma leitura única, quem ia a caminho
 * de uma loja via as distâncias congeladas no sítio onde carregou no botão. Assim a lista
 * reordena-se sozinha à medida que a pessoa anda.
 *
 * **Só arranca a pedido.** A localização é dado pessoal e não se pede sem que alguém queira
 * saber qual é a loja mais perto; e `parar()` desliga de vez, não apenas esconde.
 *
 * Todas as falhas têm estado e texto próprios. Antes, negar a autorização deixava um botão
 * que aparentemente não fazia nada — e negar, estar sem GPS ou ficar sem tempo pedem
 * respostas diferentes.
 */
export default function useLocalizacaoAoVivo() {
  const [estado, setEstado] = useState('inactivo');
  const [posicao, setPosicao] = useState(null);
  const [erro, setErro] = useState('');
  const vigia = useRef(null);

  const limpar = useCallback(() => {
    if (vigia.current !== null) {
      navigator.geolocation?.clearWatch(vigia.current);
      vigia.current = null;
    }
  }, []);

  const parar = useCallback(() => {
    limpar();
    setEstado('inactivo');
    setPosicao(null);
    setErro('');
  }, [limpar]);

  const comecar = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setEstado('indisponivel');
      setErro('Este navegador não sabe dizer onde está. Use a pesquisa por nome ou província.');
      return;
    }
    limpar();
    setEstado('a-pedir');
    setErro('');
    vigia.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        setPosicao({ latitude: coords.latitude, longitude: coords.longitude, precisao: coords.accuracy });
        setEstado('activo');
      },
      (e) => {
        // Com a autorização negada o navegador não volta a chamar; nos outros casos
        // continuaria a tentar em silêncio por trás de uma mensagem de erro.
        limpar();
        setErro(mensagemDeErro(e?.code));
        setEstado('erro');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  }, [limpar]);

  // Sair da página desliga o GPS. Sem isto, a vigia ficava a correr a gastar bateria.
  useEffect(() => limpar, [limpar]);

  return { estado, posicao, erro, comecar, parar };
}
