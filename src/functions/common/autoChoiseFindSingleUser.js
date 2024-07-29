// выбирает единственного найденного сотрудника при поиске через +
export default function autoChoiseFindSingleUser() {
  const finderUsers = document.querySelector('div#BXSocNetLogDestinationSearch.popup-window.bx-finder-popup.bx-finder-v2');
  if (finderUsers) {
    const users = finderUsers.querySelectorAll('a.bx-finder-box-item-t7.bx-finder-element.bx-lm-element-user');
    if (users.length === 1) users[0].click();
  }
}
