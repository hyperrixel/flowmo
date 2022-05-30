const FLOWMO_HIDING = 0;
const FLOWMO_PET_VISIBLE = 1;
const FLOWMO_BOX_VISIBLE = 2;
const FLOWMO_MENU_VISIBLE = 4;
const FLOWMO_MODAL_VISIBLE = 8;

const FLOWMO_STATE_NOT_INITIALIZED = 0;
const FLOWMO_STATE_INIT_IN_PROGRESS = 1;
const FLOWMO_STATE_INIT_FINISHED = 2;
const FLOWMO_STATE_INIT_ERROR = -1;

const FLOWMO_NO_ACTION = 0;

const FLOWMO_OBJECTS = {cloth : 3, shoes : 5, makeup : 7, mouth : 8,
                        headphones : 10, bikini : 4};

const FLOWMO_MODAL_LARGE = 'large';
const FLOWMO_MODAL_MEDIUM = 'medium';
const FLOWMO_MODAL_SMALL = 'small';

class Cookies {

  static getValue(pName) {

    var result = null;
    var cookieList = decodeURIComponent(document.cookie).split(';');
    var indexOfName = -1;
    for (var i = 0;i < cookieList.length; i++) {
      indexOfName = cookieList[i].indexOf(pName) + 1;
      if (indexOfName > -1) {
        result = cookieList[i].substring(indexOfName + pName.length,
                                         cookieList[i].length);
        break;
      }
    }
    return result;

  }

  static isSet(pName) {

    var result = false;
    var cookieList = decodeURIComponent(document.cookie).split(';');
    var indexOfName = -1;
    for (var i = 0;i < cookieList.length; i++) {
      indexOfName = cookieList[i].indexOf(pName);
      if (indexOfName > -1) {
        result = true;
        break;
      }
    }
    return result;

  }

  static listAll() {

    var result = new Array();
    var cookieList = decodeURIComponent(document.cookie).split(';');
    var thisCookie;
    for (var i = 0;i < cookieList.length; i++) {
      thisCookie = cookieList[i].trim().split('=');
      if (thisCookie[0] != '')
        result.push({name : thisCookie[0], value : thisCookie[1]});
    }
    return result;

  }

  static set(pName, pValue, pExpire, pPath = '/', pSameSite = 'None',
             pSecure = true) {

    var expire = new Date();
    var secure = '';
    if (pSecure) secure = ';secure';
    expire.setTime(expire.getTime() + pExpire);
    document.cookie = pName + '=' + pValue + ';expires=' + expire.toUTCString()
                      + ';path=' + pPath + ';SameSite=' + pSameSite + secure;

  }

}

class flowmo {

  static apiRoot = 'https://flowmo.hyperrixel.com/api/';
  static appId = '';
  static borderZone = 100;
  static bubble = true;
  static currentAction = FLOWMO_NO_ACTION;
  static hoveredList = new Array();
  static isUser = false;
  static menuSize = 6;
  static pet = undefined;
  static state = FLOWMO_STATE_NOT_INITIALIZED;
  static taskEnd = 0;
  static taskEndAction = {action : '', parameter : ''};
  static taskHandler = undefined;
  static taskList = [];
  static totalAdditionalCost = 0;
  static totalCost = 0;
  static visualState = FLOWMO_HIDING;

  static addVisualState(pStateId) {

    if (! flowmo.hasVisualState(pStateId)) flowmo.visualState += pStateId;

  }

  static askApi(pEndpoint, pWait = true) {

    if (flowmo.state == FLOWMO_STATE_INIT_FINISHED) {
      $.ajax({url : flowmo.apiRoot + '?endpoint=' + pEndpoint,
              method : 'POST',
              data : {flowmo_app_id : 'app_test_id'},
              crossDomain : true,
              xhrFields : {
                withCredentials: true
              },
              success : flowmo.handleApiResponse,
              error : flowmo.handleApiError
            });
    } else if (pWait) setTimeout(flowmo.askApi, 1000, pEndpoint);
    else console.warn('flowmo: Not ready to query API.');

  }

  static box(pAction, pContent = '') {

    if (flowmo.state == FLOWMO_STATE_INIT_FINISHED
        && flowmo.hasVisualState(FLOWMO_PET_VISIBLE)) {
      switch (pAction) {
        case 'hide':
          $('#flowmo_box').hide();
          flowmo.deleteVisualState(FLOWMO_BOX_VISIBLE);
          break;
        case 'show':
          $('#flowmo_box').html(pContent);
          $('#flowmo_box').show();
          flowmo.addVisualState(FLOWMO_BOX_VISIBLE);
          break;
        case 'toggle':
          if (flowmo.hasVisualState(FLOWMO_BOX_VISIBLE)) {
            $('#flowmo_box').hide();
            flowmo.deleteVisualState(FLOWMO_BOX_VISIBLE);
          } else {
            $('#flowmo_box').show();
            flowmo.addVisualState(FLOWMO_BOX_VISIBLE);
          }
          break;
        default:
      }
    }

  }

  static deleteVisualState(pStateId) {

    if (flowmo.hasVisualState(pStateId)) flowmo.visualState -= pStateId;

  }

  static getAppId() {

    if (Cookies.isSet('flowmo_app_id'))
      flowmo.appId = Cookies.getValue('flowmo_app_id');
    else if (sessionStorage.getItem('flowmo_app_id') !== null)
      flowmo.appId = sessionStorage.getItem('flowmo_app_id');
    else if ($('template').length > 0) {
      var templates = $('template');
      for (var i=0; i < templates.length; i++)
        if (templates[i].attributes.flowmo_app_id !== undefined) {
          flowmo.appId = templates[i].attributes.flowmo_app_id;
          break;
        }
    }

  }

  static handleApiError(xhr, status, thrown) {

    console.log({xhr : xhr, status : status, thrownError : thrown});

  }

  static handleApiResponse(response) {

    if (response.error == '') {
      if (response.session !== undefined)
        for (const key in response.session)
          sessionStorage.setItem(key, response.session[key]);
      switch (response.endpoint) {
        case 'hello':
          if (response.result == 'anonymous') flowmo.isUser = false;
          else if (response.result == 'user') flowmo.isUser = true;
          else console.warn('flowmo hello: invalid result.')
          flowmo.updateMenu();
          break;
        default:
      }
      for (var i=0; i < response.task.length; i++) flowmo.taskList.push(response.task[i]);
    } else console.warn('flowmo API error: ' + response.error);

  }

  static handleClick(e) {

    // Use target ID
    if (e.target.id !== undefined) {
      if (e.target.id.indexOf('flowmo_menu_') > -1) {
        flowmo.menu('hide');
        flowmo.menu(e.target.id);
        if (flowmo.taskEndAction.action == 'boxhide') {
          flowmo.taskEndAction.action == '';
          flowmo.taskEnd = 0;
        }
        return flowmo.bubble;
      }
    }
    // User target or parent class
    if (flowmo.hasClass('flowmo-box', e.target)) {
      flowmo.box('hide');
      return false;
    }
    // User target or parent attribute
    var toWear = flowmo.hasAttribute('flowmo_wear', e.target);
    if (toWear !== undefined) {
      flowmo.taskList.push({action : 'wear', parameter : toWear.value, duration : 5});
      return false;
    }
    return flowmo.bubble;

  }

  static handleContextMenu(e) {

    var result = flowmo.bubble;
    if (e.target.id !== undefined) {
      if (e.target.id == 'flowmo_app_cover') {
        flowmo.menu('toggle');
        result = false;
      } else if (e.target.id.indexOf('flowmo_menu_') > -1) result = false;
    }
    return result;

  }

  static handleHoverIn(e) {

    var isNew = true;
    for (var i = 0; i < flowmo.hoveredList.length; i++)
      if (flowmo.hoveredList[i] === this) {
        isNew = false;
        break;
      }
    if (isNew) flowmo.hoveredList.push(this);
    return flowmo.bubble;

  }

  static handleHoverOut(e) {

    if (flowmo.hoveredList[flowmo.hoveredList.length - 1] === this)
      flowmo.hoveredList.pop()
    else {
      var position = -1;
      for (var i = 0; i < flowmo.hoveredList.length; i++)
        if (flowmo.hoveredList[i] === this) {
          position = i;
          break;
        }
      if (position > -1) flowmo.hoveredList.splice(position, 1);
    }
    return flowmo.bubble;

  }

  static handleMove(e) {

    if (e.pageY < flowmo.borderZone) {
        flowmo.modal('show', 'large', {title : 'Don\'t run away..', content : '<p>I sense you want to leave the site. There are items in your cart.</p><p>Do you really want to run away from your potential belongings? Only 1 minute is needed to order those items.</p>'});
    }

  }

  static hasAttribute(pAttribute, pElement) {

    var result = pElement.attributes[pAttribute];
    if (result === undefined && pElement.parentElement !== null)
      result = flowmo.hasAttribute(pAttribute, pElement.parentElement);
    return result;

  }

  static hasClass(pClassName, pElement) {

    var result = false;
    for (var i=0; i < pElement.classList.length; i++) {
      if (pElement.classList[i] == pClassName) {
        result = true;
        break;
      }
    }
    if (! result && pElement.parentElement !== null)
      result = flowmo.hasClass(pClassName, pElement.parentElement);
    return result;

  }

  static hasVisualState(pStateId) {

    return Math.floor(flowmo.visualState / pStateId) % 2 == 1;

  }

  static hide(objectName) {

    if (objectName in FLOWMO_OBJECTS)
      flowmo.pet.childNodes[1].childNodes[FLOWMO_OBJECTS[objectName]].style.display = 'none';

  }

  static init() {

    if (typeof $ === 'function') {
      if (existCSSClass('flowmo-app')) {
        flowmo.getAppId();
        if (flowmo.appId != '') {
          flowmo.state = FLOWMO_STATE_INIT_IN_PROGRESS;
          $('body').append('<div class="flowmo-app"><object data="https://flowmo.hyperrixel.com/flowmo_pet.svg" id="flowmo_pet" type="image/svg+xml" ></object></div><div class="flowmo-app-cover" id="flowmo_app_cover"></div>');
          $('#flowmo_pet').on('load', flowmo.initPet);
          $('*').click(flowmo.handleClick);
          $('*').contextmenu(flowmo.handleContextMenu);
          $('html').mousemove(flowmo.handleMove);
        } else {
          flowmo.state = FLOWMO_STATE_INIT_ERROR;
          console.warn('flowmo: Please set the flowmo_app_id according to the ID of your shop.');
        }
      } else {
        flowmo.state = FLOWMO_STATE_INIT_ERROR;
        console.warn('flowmo: Please include flowmo.css from here: https://flowmo.hyperrixel.com/flowmo.css');
      }
    } else {
      flowmo.state = FLOWMO_STATE_INIT_ERROR;
      console.warn('flowmo: Please include JQuery');
    }
    if (flowmo.state == FLOWMO_STATE_NOT_INITIALIZED) setTimeout(flowmo.init, 1000);

  }

  static initPet() {

    $('body').append('<div class="flowmo-box" id="flowmo_box"></div>');
    var menuContent = '<div class="flowmo-menu" id="flowmo_menu">';
    for (var i=0; i < flowmo.menuSize; i++)
      menuContent += '<div class="flowmo-menu-item" id="flowmo_menu_' + i
                     + '">Function ' + i + '</div>';
    menuContent += '</div>';
    $('body').append(menuContent);
    $('body').append('<div class="modal fade" id="flowmo_modal_small" tabindex="-1" aria-labelledby="flowmo_modal_small_title" aria-hidden="true"><div class="modal-dialog modal-sm"><div class="modal-content flowmo-modal-dialog"><div class="modal-header"><h5 class="modal-title" id="flowmo_modal_small_title"></h5><button type="button" class="btn-close flowmo-btn-cancel" data-bs-dismiss="modal" aria-label="Close"></button></div><div class="modal-body"><div class="container-fluid" id="flowmo_modal_small_content"></div></div><div class="modal-footer"><button type="button" class="btn btn-secondary app-btn-cancel" id="flowmo_modal_small_btn_cancel" data-bs-dismiss="modal">Cancel</button><button type="button" class="btn btn-primary" id="flowmo_modal_small_btn_ok">Ok</button></div></div></div></div>');
    $('body').append('<div class="modal fade" id="flowmo_modal_medium" tabindex="-1" aria-labelledby="flowmo_modal_medium_title" aria-hidden="true"><div class="modal-dialog"><div class="modal-content flowmo-modal-dialog"><div class="modal-header"><h5 class="modal-title" id="flowmo_modal_medium_title"></h5><button type="button" class="btn-close flowmo-btn-cancel" data-bs-dismiss="modal" aria-label="Close"></button></div><div class="modal-body"><div class="container-fluid" id="flowmo_modal_medium_content"></div></div><div class="modal-footer"><button type="button" class="btn btn-secondary app-btn-cancel" id="flowmo_modal_medium_btn_cancel" data-bs-dismiss="modal">Cancel</button><button type="button" class="btn btn-primary" id="flowmo_modal_medium_btn_ok">Ok</button></div></div></div></div>');
    $('body').append('<div class="modal fade" id="flowmo_modal_large" tabindex="-1" aria-labelledby="flowmo_modal_large_title" aria-hidden="true"><div class="modal-dialog modal-lg"><div class="modal-content flowmo-modal-dialog"><div class="modal-header"><h5 class="modal-title" id="flowmo_modal_large_title"></h5><button type="button" class="btn-close flowmo-btn-cancel" data-bs-dismiss="modal" aria-label="Close"></button></div><div class="modal-body"><div class="container-fluid" id="flowmo_modal_large_content"></div></div><div class="modal-footer"><button type="button" class="btn btn-secondary app-btn-cancel" id="flowmo_modal_large_btn_cancel" data-bs-dismiss="modal">Cancel</button><button type="button" class="btn btn-primary" id="flowmo_modal_large_btn_ok">Ok</button></div></div></div></div>');
    flowmo.updateMenu();
    flowmo.pet = $('#flowmo_pet')[0].contentDocument;
    flowmo.state = FLOWMO_STATE_INIT_FINISHED;
    flowmo.addVisualState(FLOWMO_PET_VISIBLE);
    flowmo.box('hide');
    flowmo.menu('hide');
    if (flowmo.taskHandler === undefined)
      flowmo.taskHandler = setInterval(flowmo.taskManager, 1000);
    flowmo.askApi('hello');

  }

  static menu(pAction) {

    if (flowmo.state == FLOWMO_STATE_INIT_FINISHED
        && flowmo.hasVisualState(FLOWMO_PET_VISIBLE)) {
      switch (pAction) {
        case 'flowmo_menu_0':
          if (flowmo.isUser) {
            flowmo.perform('smallmodalshow', {title : 'Logout', content : 'Log out?'});
          } else {
            flowmo.perform('smallmodalshow', {title : 'Login or register', content : 'Log in register...'});
          }
        case 'hide':
          $('#flowmo_menu').hide();
          flowmo.deleteVisualState(FLOWMO_MENU_VISIBLE);
          break;
        case 'show':
          $('#flowmo_menu').show();
          flowmo.addVisualState(FLOWMO_MENU_VISIBLE)
          break;
        case 'toggle':
          if (flowmo.hasVisualState(FLOWMO_MENU_VISIBLE)) {
            $('#flowmo_menu').hide();
            flowmo.deleteVisualState(FLOWMO_MENU_VISIBLE);
          } else {
            $('#flowmo_menu').show();
            flowmo.addVisualState(FLOWMO_MENU_VISIBLE);
          }
          break;
        default:
      }
    }

  }

  static modal(pAction, pSize = '', pParameter = '') {

    var modals = ['small', 'medium', 'large'];
    if (pSize != '') modals = [pSize];
    if (flowmo.state == FLOWMO_STATE_INIT_FINISHED
        && flowmo.hasVisualState(FLOWMO_PET_VISIBLE)) {
      switch (pAction) {
        case 'hide':
          for (var i=0; i < modals.length; i++) {
            $('#flowmo_modal_' + modals[i] + '_title').html('');
            $('#flowmo_modal_' + modals[i] + '_content').html('');
            $('#flowmo_modal_' + modals[i]).modal('hide');
          }
          flowmo.deleteVisualState(FLOWMO_MODAL_VISIBLE)
          break;
        case 'show':
          $('#flowmo_modal_' + pSize + '_title').html(pParameter.title);
          $('#flowmo_modal_' + pSize + '_content').html(pParameter.content);
          $('#flowmo_modal_' + pSize).modal('show');
          flowmo.addVisualState(FLOWMO_MODAL_VISIBLE);
          break;
        case 'toggle':
          if (flowmo.hasVisualState(FLOWMO_MODAL_VISIBLE)) {
            for (var i=0; i < modals.length; i++)
              $('#flowmo_modal_' + modals[i]).modal('hide');
            flowmo.deleteVisualState(FLOWMO_MODAL_VISIBLE);
          } else {
            for (var i=0; i < modals.length; i++)
              $('#flowmo_modal_' + modals[i]).modal('show');
            flowmo.addVisualState(FLOWMO_MODAL_VISIBLE);
          }
          break;
        default:
      }
    }

  }

  static perform(pAction, pParameter) {

    var result = {action : '', parameter : ''};
    switch (pAction) {
      case 'boxhide':
        flowmo.box('hide');
        break;
      case 'boxshow':
        flowmo.box('show', pParameter);
        result.action = 'boxhide';
        break;
      case 'boxtoggle':
        flowmo.box('toggle');
        break;
      case 'largemodalhide':
        flowmo.modal('hide', 'large');
        break;
      case 'largemodalshow':
        flowmo.modal('show', 'large', pParameter);
        result.action = 'largemodalhide';
        break;
      case 'largemodaltoggle':
        flowmo.modal('toggle', 'large');
        result.action = 'largemodaltoggle';
        break;
      case 'mediummodalhide':
        flowmo.modal('hide', 'medium');
        break;
      case 'mediummodalshow':
        flowmo.modal('show', 'medium', pParameter);
        result.action = 'mediummodalhide';
        break;
      case 'mediummodaltoggle':
        flowmo.modal('toggle', 'medium');
        result.action = 'mediummodaltoggle';
        break;
      case 'modalhide':
        flowmo.modal('hide');
        break;
      case 'modaltoggle':
        flowmo.modal('toggle');
        break;
      case 'smallmodalhide':
        flowmo.modal('hide', 'small');
        break;
      case 'smallmodalshow':
        flowmo.modal('show', 'small', pParameter);
        result.action = 'smallmodalhide';
        break;
      case 'smallmodaltoggle':
        flowmo.modal('toggle', 'small');
        result.action = 'smallmodaltoggle';
        break;
      case 'wear':
        flowmo.show(pParameter);
        result.action = 'wearhide';
        result.parameter = pParameter;
        break;
      case 'wearhide':
        flowmo.hide(pParameter);
        break;
      case 'weartoggle':
        flowmo.toggle(pParameter);
        break;
      default:
    }
    return result;

  }

  static show(objectName) {

    if (objectName in FLOWMO_OBJECTS)
      flowmo.pet.childNodes[1].childNodes[FLOWMO_OBJECTS[objectName]].style.display = 'inline';

  }

  static taskManager()  {

    if (flowmo.state == FLOWMO_STATE_INIT_FINISHED
        && flowmo.hasVisualState(FLOWMO_PET_VISIBLE)
        && ! flowmo.hasVisualState(FLOWMO_MODAL_VISIBLE)) {
      var now = Math.floor(new Date().getTime() / 1000);
      if (flowmo.taskEnd > 0 && flowmo.taskEnd < now) {
        if (flowmo.taskEndAction.action != '')
          flowmo.perform(flowmo.taskEndAction.action, flowmo.taskEndAction.parameter);
          flowmo.taskEndAction.action = '';
          flowmo.taskEndAction.parameter = '';
          flowmo.taskEnd = 0;
      }
      var pos = 0;
      while (pos < flowmo.taskList.length) {
        if (flowmo.taskList[pos].duration === undefined
            || flowmo.taskList[pos].duration == 0) {
          flowmo.perform(flowmo.taskList[pos].action, flowmo.taskList[pos].parameter)
          flowmo.taskList.splice(pos, 1);
        } else if (flowmo.taskList[pos].duration == -1) {
          if (flowmo.taskEndAction.action != '') {
            flowmo.perform(flowmo.taskEndAction.action, flowmo.taskEndAction.parameter);
            flowmo.taskEndAction.action = '';
            flowmo.taskEndAction.parameter = '';
            flowmo.taskEnd = 0;
          }
          flowmo.perform(flowmo.taskList[pos].action, flowmo.taskList[pos].parameter)
          flowmo.taskList.splice(pos, 1);
          return;
        } else {
          if (flowmo.taskEndAction.action == '') {
            var actionEnd = flowmo.perform(flowmo.taskList[pos].action, flowmo.taskList[pos].parameter);
            flowmo.taskEndAction = actionEnd;
            if (flowmo.taskEndAction.action != '')
              flowmo.taskEnd = now + flowmo.taskList[pos].duration;
            flowmo.taskList.splice(pos, 1);
          } else pos++;
        }
      }
    }

  }

  static toggle(objectName) {

    if (objectName in FLOWMO_OBJECTS)
      if (flowmo.pet.childNodes[1].childNodes[FLOWMO_OBJECTS[objectName]].style.display == 'none')
        flowmo.pet.childNodes[1].childNodes[FLOWMO_OBJECTS[objectName]].style.display = 'inline';
      else flowmo.pet.childNodes[1].childNodes[FLOWMO_OBJECTS[objectName]].style.display = 'none';

  }

  static updateMenu() {

    $('#flowmo_menu_1').text('Fill form');
    $('#flowmo_menu_2').text('Manage data');
    $('#flowmo_menu_3').text('Manage shop');
    $('#flowmo_menu_4').text('Privacy, policy');
    $('#flowmo_menu_5').text('About');
    for (var i=0; i < flowmo.menuSize; i++) {
      $('#flowmo_menu_' + i).removeClass('flowmo-menu-item-disabled');
      $('#flowmo_menu_' + i).removeClass('flowmo-menu-item');
      $('#flowmo_menu_' + i).addClass('flowmo-menu-item');
    }
    if (flowmo.isUser) {
      $('#flowmo_menu_0').text('Logout');
    }
    else {
      $('#flowmo_menu_0').text('Login / Register');
      $('#flowmo_menu_1').addClass('flowmo-menu-item-disabled');
      $('#flowmo_menu_2').addClass('flowmo-menu-item-disabled');
      $('#flowmo_menu_3').addClass('flowmo-menu-item-disabled');
    }

  }

}

function existCSSClass(pClassName) {

  var result = false;
  var selector;
  if (pClassName[0] == '.') selector = pClassName;
  else selector = '.' + pClassName;
  for (var i = 0; i < document.styleSheets.length; i++)
  try {
    for (var j = 0; j < document.styleSheets[i].cssRules.length; j++)
      if (document.styleSheets[i].cssRules[j].selectorText == selector) {
        result = true;
        break
      }
  } catch (DOMException) {}
  return result;

}
