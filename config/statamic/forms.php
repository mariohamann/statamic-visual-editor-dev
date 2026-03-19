<?php

use Statamic\Forms\Exporters\CsvExporter;
use Statamic\Forms\Exporters\JsonExporter;
use Statamic\Forms\SendEmail;

return [

    /*
    |--------------------------------------------------------------------------
    | Forms Path
    |--------------------------------------------------------------------------
    |
    | Where your form YAML files are stored.
    |
    */

    'forms' => resource_path('forms'),

    /*
    |--------------------------------------------------------------------------
    | Submissions Path
    |--------------------------------------------------------------------------
    |
    | Where your form submissions are stored.
    |
    */

    'submissions' => storage_path('forms'),

    /*
    |--------------------------------------------------------------------------
    | Email View Folder
    |--------------------------------------------------------------------------
    |
    | The folder under resources/views where your email templates are found.
    |
    */

    'email_view_folder' => null,

    /*
    |--------------------------------------------------------------------------
    | Send Email Job
    |--------------------------------------------------------------------------
    |
    | The class name of the job that will be used to send an email.
    |
    */

    'send_email_job' => SendEmail::class,

    /*
    |--------------------------------------------------------------------------
    | Exporters
    |--------------------------------------------------------------------------
    |
    | Here you may define all the available form submission exporters.
    | You may customize the options within each exporter's array.
    |
    */

    'exporters' => [
        'csv' => [
            'class' => CsvExporter::class,
        ],
        'json' => [
            'class' => JsonExporter::class,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | CSV Export Delimiter
    |--------------------------------------------------------------------------
    |
    | Statamic will use this character as delimiter for csv exports.
    |
    */

    'csv_delimiter' => ',',

    /*
    |--------------------------------------------------------------------------
    | CSV Export Headings
    |--------------------------------------------------------------------------
    |
    | The values to be used in the csv export header rows.
    | Can be the field handle or the field display text.
    |
    | Supported values: "handle", "display"
    |
    */

    'csv_headers' => 'display',

];
