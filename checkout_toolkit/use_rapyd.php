<?php

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

$API_BASE = 'https://sandboxapi.rapyd.net';
$ENDPOINT_BASE = '/v1/';

$ACCESS_KEY = 'YOUR_ACCESS_KEY';
$SECRET_KEY = 'YOUR_SECRET_KEY';

$REQUIRED_FIELDS = ['ask_rapyd' => ['endpoint'],
                    'create_checkout' => ['amount', 'currency', 'country',
                                          'merchant_reference_id']];
$OPTIONAL_FIELDS = ['ask_rapyd' => ['post_data', 'header'],
                    'create_checkout' => ['options']];

$CURL_OPTIONS = array(
  CURLOPT_RETURNTRANSFER => True,
  // CURLOPT_FOLLOWLOCATION => True,
  // CURLOPT_ENCODING       => "",
  CURLOPT_USERAGENT      => 'team_rixel',
  // CURLOPT_AUTOREFERER    => True,
  CURLOPT_CONNECTTIMEOUT => 120,
  CURLOPT_TIMEOUT        => 120,
  // CURLOPT_MAXREDIRS      => 10,
  CURLOPT_SSL_VERIFYPEER => False,

  // CURLOPT_NOBODY => False,

);

function run_curl($p_path, $p_post_data = null, $p_header = False) {

  global $CURL_OPTIONS;

  $t_curl = curl_init($p_path);
  curl_setopt_array($t_curl, $CURL_OPTIONS);
  if (is_bool($p_header)) curl_setopt($t_curl, CURLOPT_HEADER, $p_header);
  else curl_setopt($t_curl, CURLOPT_HTTPHEADER, $p_header);
  if (! is_null($p_post_data)) {
    curl_setopt($t_curl, CURLOPT_POST , True);
    curl_setopt($t_curl, CURLOPT_POSTFIELDS, $p_post_data);
  } else curl_setopt($t_curl, CURLOPT_POST , False);
  $t_result = curl_exec($t_curl);
  $t_error = curl_error($t_curl); // TODO: implement handling
  curl_close($t_curl);
  return $t_result;

}

function ask_rapyd($p_endpoint, $p_body = null, $p_http_method = 'get') {

  global $ACCESS_KEY;
  global $API_BASE;
  global $ENDPOINT_BASE;
  global $SECRET_KEY;

  $t_path = $ENDPOINT_BASE . $p_endpoint;
  $t_salt = mt_rand(10000000, 99999999);
  $t_timestamp = time();
  $t_body = '';
  if (! is_null($p_body) > 0) $t_body = json_encode($p_body);
  $t_signature = base64_encode(hash_hmac('sha256',
                                         $p_http_method . $t_path . $t_salt
                                         . $t_timestamp . $ACCESS_KEY
                                         . $SECRET_KEY . $t_body,
                                         $SECRET_KEY));
  $t_header = array('Content-Type: application/json',
                    "access_key: $ACCESS_KEY",
                    "salt: $t_salt",
                    "timestamp: $t_timestamp",
                    "signature: $t_signature");
  if ($t_body == '') $t_body = null;
  return run_curl($API_BASE . $t_path, $t_body, $t_header);

}

function create_checkout($p_amount, $p_currency, $p_country, $p_reference_id, $p_options = null) {

  $t_body = array('amount' => strval($p_amount), 'currency' => $p_currency,
                  'country' => $p_country,
                  'merchant_reference_id' => $p_reference_id,
                  'page_expiration' => strval(time() + 86400)); // For hackathon only.
  if (! is_null($p_options)) $t_body = array_merge($t_body, $p_options);
  return ask_rapyd('checkout', $t_body, 'post');

}

function get_field($p_field_name) {

  $t_result = null;
  if (array_key_exists($p_field_name, $_GET)) $t_result = $_GET[$p_field_name];
  else if (array_key_exists($p_field_name, $_POST)) $t_result = $_POST[$p_field_name];
  return $t_result;

}

function get_origin() {

  $t_result = '';
  if (array_key_exists("HTTP_ORIGIN", $_SERVER))
    $t_result = $_SERVER["HTTP_ORIGIN"];
  else if (array_key_exists("HTTP_REFERER", $_SERVER))
    $t_result = $_SERVER["HTTP_REFERER"];
  else $t_result = $_SERVER["REMOTE_ADDR"];
  return $t_result;

}

header('Access-Control-Allow-Origin: ' . get_origin() . '');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json');

$action = get_field('action');
if (! is_null($action)) {
  if (array_key_exists($action, $REQUIRED_FIELDS)) {
    $missing_fields = array();
    foreach ($REQUIRED_FIELDS[$action] as $field) {
      if (is_null(get_field($field))) $missing_fields[] = $field;
    }
    if (count($missing_fields) == 0) {
      switch ($action) {
        case 'ask_rapyd':
          if (is_null(get_field('header'))) $header = 'get';
          else $header = get_field('header');
          echo(ask_rapyd(get_field('endpoint'),
                         get_field('post_data'),
                         $header));
          break;
        case 'create_checkout':
          echo(create_checkout(get_field('amount'),
                               get_field('currency'),
                               get_field('country'),
                               get_field('merchant_reference_id'),
                               get_field('options')));
          break;
        default:
          break;
      }
    } else {
      echo(json_encode(['error' => 'Missing field(s): ' . implode(', ', $missing_fields) . '.', 'result' => []]));
    }
  } else {
    echo(json_encode(['error' => 'Invalid action.', 'result' => []]));
  }
} else {
  echo(json_encode(['error' => 'No action.', 'result' => []]));
}

?>
