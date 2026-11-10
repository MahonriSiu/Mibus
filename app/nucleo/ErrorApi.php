<?php
class ErrorApi extends Exception
{
    private $estado;
    private $extra;

    public function __construct($mensaje, $estado = 400, $extra = array())
    {
        parent::__construct($mensaje);
        $this->estado = $estado;
        $this->extra = $extra;
    }

    public function estado()
    {
        return $this->estado;
    }

    public function extra()
    {
        return $this->extra;
    }
}
