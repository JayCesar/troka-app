Você é um desenvolvedor front-end sênior, com experiência em React/web responsivo e design de interfaces. Sua tarefa é aplicar um conjunto de ajustes em um site existente (o front-end do projeto) e entregar o código alterado, pronto para uso.

O objetivo principal é que, após suas alterações, o site apresente os seguintes comportamentos:

1. **Botão de cadastro na tela de login.** Adicione um botão/link de cadastro visível na tela de login, que leve o usuário à tela de criação de conta. Hoje esse botão não aparece.

1.1 **Página inciial**: crie uma página inicial também (focada mais pra ia) onde quando o logo for clicada (se n tiver logado vai pra tela de login) se tiver lgoado, vai pra tela q lista as ações que o usuário logado pode fazer

2. **Paleta de cores alinhada ao logo Trokka.** Ajuste as cores do site (fundo, botões, destaques, textos de destaque) para se aproximarem das cores do logo Trokka. Caso o logo ou o código de cores não tenham sido enviados, use as cores presentes no logo como referência e centralize essas definições em variáveis de tema (por exemplo, CSS variables ou um arquivo de tema) para facilitar ajustes futuros.

3. **Gravação de áudio no chat com IA.** Ao lado do botão de enviar, adicione um botão para gravar áudio. O áudio gravado deve ser capturado pelo navegador (MediaRecorder ou API equivalente), transcrito ou enviado como entrada para a IA, para que o médico ou enfermeiro possa falar em vez de digitar. Priorize o uso no celular: o botão deve ser grande o suficiente para toque, com feedback visual claro de gravação ativa (por exemplo, indicador vermelho pulsante e tempo decorrido). Trate permissões de microfone e navegadores sem suporte com mensagens claras.

4. **Calendário mensal com filtro de período.** O calendário deve exibir o mês inteiro, não apenas a semana. Adicione um filtro para selecionar o intervalo de datas exibido: 3 dias, 1 semana, 15 dias e 1 mês. O comportamento e a apresentação devem se assemelhar ao Google Calendar.

5. **Menu superior fixo no desktop.** Ao acessar o site pelo computador, os botões de navegação devem estar em um menu superior fixo, e não escondidos no rodapé ou em áreas de rolagem. Esse menu deve conter as funções principais e os botões de **entrar** e **sair** (login/logout), que alternam conforme o estado de autenticação do usuário.

6. **Hover e cursor indicativos.** Adicione estados de hover em todos os elementos clicáveis (botões, links, itens de menu, datas do calendário), com mudança visual e cursor do tipo `pointer`. Elementos não clicáveis devem manter o cursor padrão, para que fique claro o que pode ser acionado.

Diretrizes de execução:
- Altere apenas o que é necessário para esses seis pontos; não refatore módulos não relacionados.
- Mantenha o padrão de código, nomes de arquivos e estrutura de componentes já existentes no projeto.
- Garanta que o layout continue funcional em celular e desktop, já que o item de áudio é voltado ao uso mobile.
- Ao final, liste os arquivos modificados e explique brevemente cada alteração, indicando qualquer suposição feita por falta de informação (como o código exato das cores do logo).