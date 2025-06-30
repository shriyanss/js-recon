import chalk from "chalk";
import blessed from 'blessed';

const interactive = async () => {
  // Create a screen object.
  const screen = blessed.screen({
    smartCSR: true,
    title: 'js-recon interactive mode',
    fullUnicode: true,
  });

  const titleBox = blessed.box({
    parent: screen,
    top: 0,
    left: 'center',
    width: '80%',
    height: 3,
    content: 'JS Recon Interactive Mode',
    border: {
      type: 'line',
    },
    style: {
      fg: 'white',
      border: {
        fg: 'gray',
      },
    },
  });

  const inputBox = blessed.textbox({
    parent: screen,
    bottom: 1,
    left: 'center',
    width: '80%',
    height: 3,
    border: {
      type: 'line',
    },
    style: {
      fg: 'white',
      bg: 'black',
      border: {
        fg: 'gray',
      },
      focus: {
        border: {
          fg: 'blue',
        },
      },
    },
    inputOnFocus: true,
  });

  const helpBox = blessed.box({
      parent: screen,
      bottom: 4,
      left: 'center',
      width: '80%',
      height: 4,
      content: ' /history Open command history\n /help Show list of commands\n /exit Exit interactive mode',
      style: {
          fg: 'white',
          bg: '#4A4A4A'
      },
      hidden: true,
  });

  const footer = blessed.box({
    parent: screen,
    bottom: 0,
    left: 'center',
    width: '80%',
    height: 1,
    content: 'ctrl+c to exit | "/" to see commands | enter to send - 100% context left',
    style: {
      fg: 'gray',
    },
  });

  inputBox.on('keypress', (ch, key) => {
      const text = inputBox.getValue();
      if (text.startsWith('/')) {
          helpBox.show();
      } else {
          helpBox.hide();
      }
      if (key.name === 'backspace' && text.length <= 1) {
          helpBox.hide();
      }
      screen.render();
  });

  inputBox.focus();

  inputBox.on('submit', (text) => {
    if (text === 'exit' || text === '/exit') {
      return;
    }
    inputBox.clearValue();
    inputBox.focus();
    screen.render();
  });

  screen.key(['escape', 'q', 'C-c'], (ch, key) => {
    return;
  });

  screen.render();
};

export default interactive;
