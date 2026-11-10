<?php
require_once RAIZ . '/app/vendor/fpdf/fpdf.php';

class Pdf extends FPDF
{
    private $titulo = '';
    private $subtitulo = '';
    private $angulo = 0;
    private $marca = true;

    public static function t($texto)
    {
        $convertido = @iconv('UTF-8', 'windows-1252//TRANSLIT//IGNORE', (string) $texto);
        return $convertido === false ? (string) $texto : $convertido;
    }

    public function configurar($titulo, $subtitulo = '', $marca = true)
    {
        $this->titulo = $titulo;
        $this->subtitulo = $subtitulo;
        $this->marca = $marca;
        $this->AliasNbPages('{total}');
        $this->SetAutoPageBreak(true, 18);
        $this->SetTitle(self::t($titulo));
        $this->SetAuthor('MiBus Bluefields');
    }

    public function Header()
    {
        $this->SetFillColor(11, 59, 74);
        $this->Rect(0, 0, 210, 26, 'F');
        $this->SetFillColor(242, 113, 39);
        $this->Rect(0, 26, 210, 1.6, 'F');
        $logo = RAIZ . '/public/assets/img/logo.png';
        if (is_file($logo)) {
            $this->Image($logo, 10, 4, 14);
        }
        $this->SetTextColor(255, 255, 255);
        $this->SetFont('Helvetica', 'B', 16);
        $this->SetXY(28, 6);
        $this->Cell(0, 7, 'MiBus Bluefields', 0, 1);
        $this->SetFont('Helvetica', '', 10);
        $this->SetX(28);
        $this->Cell(0, 6, self::t($this->titulo), 0, 1);
        $this->SetTextColor(120, 130, 140);
        $this->SetFont('Helvetica', 'I', 8);
        $this->SetXY(10, 30);
        $this->Cell(0, 5, self::t('Generado el ' . date('d/m/Y H:i') . ($this->subtitulo !== '' ? '  ·  ' . $this->subtitulo : '')), 0, 1, 'R');
        $this->SetTextColor(20, 30, 40);
        $this->SetY(38);

        if ($this->marca) {
            $this->marcaDeAgua();
        }
    }

    public function Footer()
    {
        $this->SetY(-14);
        $this->SetDrawColor(220, 226, 232);
        $this->Line(10, $this->GetY(), 200, $this->GetY());
        $this->SetFont('Helvetica', '', 8);
        $this->SetTextColor(110, 122, 134);
        $this->Cell(0, 8, self::t('MiBus Bluefields · Página ' . $this->PageNo() . ' de {total}'), 0, 0, 'C');
    }

    private function marcaDeAgua()
    {
        $logo = RAIZ . '/public/assets/img/logo.png';
        if (is_file($logo)) {
            $this->Image($logo, 65, 100, 80);
        }
    }

    public function seccion($texto)
    {
        $this->Ln(2);
        $this->SetFont('Helvetica', 'B', 12);
        $this->SetTextColor(11, 59, 74);
        $this->Cell(0, 8, self::t($texto), 0, 1);
        $this->SetDrawColor(242, 113, 39);
        $this->SetLineWidth(0.5);
        $this->Line(10, $this->GetY(), 30, $this->GetY());
        $this->SetLineWidth(0.2);
        $this->SetTextColor(20, 30, 40);
        $this->Ln(3);
    }

    public function indicadores($lista)
    {
        $n = max(1, count($lista));
        $ancho = (190 - ($n - 1) * 4) / $n;
        $x = 10;
        $y = $this->GetY();
        foreach ($lista as $k) {
            $this->SetFillColor(238, 246, 249);
            $this->SetDrawColor(210, 225, 232);
            $this->RoundedRect($x, $y, $ancho, 20, 2);
            $this->SetXY($x, $y + 3);
            $this->SetFont('Helvetica', 'B', 15);
            $this->SetTextColor(11, 59, 74);
            $this->Cell($ancho, 8, self::t($k[1]), 0, 2, 'C');
            $this->SetFont('Helvetica', '', 8);
            $this->SetTextColor(100, 116, 128);
            $this->Cell($ancho, 5, self::t($k[0]), 0, 0, 'C');
            $x += $ancho + 4;
        }
        $this->SetY($y + 25);
        $this->SetTextColor(20, 30, 40);
    }

    private function RoundedRect($x, $y, $w, $h, $r)
    {
        $this->Rect($x, $y, $w, $h, 'DF');
    }

    private function recortar($texto, $ancho)
    {
        $texto = self::t($texto);
        if ($this->GetStringWidth($texto) <= $ancho - 2) {
            return $texto;
        }
        while ($texto !== '' && $this->GetStringWidth($texto . '...') > $ancho - 2) {
            $texto = substr($texto, 0, -1);
        }
        return $texto . '...';
    }

    public function tabla($encabezados, $filas, $anchos)
    {
        $this->SetFont('Helvetica', 'B', 8.5);
        $this->SetFillColor(11, 59, 74);
        $this->SetTextColor(255, 255, 255);
        $this->SetDrawColor(11, 59, 74);
        foreach ($encabezados as $i => $h) {
            $this->Cell($anchos[$i], 8, self::t($h), 1, 0, 'L', true);
        }
        $this->Ln();
        $this->SetFont('Helvetica', '', 8.5);
        $this->SetTextColor(20, 30, 40);
        $this->SetDrawColor(225, 231, 236);
        $alterna = false;
        foreach ($filas as $fila) {
            if ($this->GetY() > 270) {
                $this->AddPage();
                $this->SetFont('Helvetica', 'B', 8.5);
                $this->SetFillColor(11, 59, 74);
                $this->SetTextColor(255, 255, 255);
                foreach ($encabezados as $i => $h) {
                    $this->Cell($anchos[$i], 8, self::t($h), 1, 0, 'L', true);
                }
                $this->Ln();
                $this->SetFont('Helvetica', '', 8.5);
                $this->SetTextColor(20, 30, 40);
            }
            $this->SetFillColor($alterna ? 244 : 255, $alterna ? 249 : 255, $alterna ? 251 : 255);
            foreach ($fila as $i => $v) {
                $this->Cell($anchos[$i], 7, $this->recortar((string) $v, $anchos[$i]), 1, 0, 'L', true);
            }
            $this->Ln();
            $alterna = !$alterna;
        }
        if (!$filas) {
            $this->SetFont('Helvetica', 'I', 9);
            $this->Cell(array_sum($anchos), 9, self::t('Sin registros para mostrar'), 1, 1, 'C');
        }
    }

    public function enviar($nombre)
    {
        $this->Output('D', $nombre, false);
        exit;
    }
}
